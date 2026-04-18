<?php

namespace App\Services\Fiber;

use App\Models\OltDevice;
use App\Models\OnuLiveStatus;
use Illuminate\Support\Carbon;

/**
 * Persist parsed ONU rows into onu_live_status (upsert by olt_device_id+serial).
 * Loose-link to fiber_onus by serial_number when possible.
 */
class OnuStatusUpdater
{
    /**
     * @param array<int,array> $onus
     * @return array{ updated:int, inserted:int }
     */
    public function apply(OltDevice $device, array $onus): array
    {
        $updated = 0; $inserted = 0;
        $linked = 0; $signalSynced = 0;
        $now = Carbon::now();
        foreach ($onus as $row) {
            $sn = (string) ($row['serial_number'] ?? '');
            if ($sn === '') continue;

            // SSOT: auto-link to existing fiber_onus by serial_number,
            // OR auto-create master row when unknown (is_unlinked=true).
            $fiberOnuId = null;
            try {
                $fiberOnuRow = \DB::table('fiber_onus')
                    ->where('serial_number', $sn)
                    ->when($device->tenant_id, fn($q) => $q->where('tenant_id', $device->tenant_id))
                    ->first(['id', 'status', 'signal_strength', 'customer_id']);

                if (!$fiberOnuRow) {
                    // Smart linking: try to auto-attach existing customer by ONU MAC/serial match.
                    $autoCustomerId = $this->resolveCustomerId($device->tenant_id, $sn, $row['mac_address'] ?? null);

                    // Hybrid mode: auto-create unlinked ONU master row (no splitter yet)
                    $newId = (string) \Str::uuid();
                    \DB::table('fiber_onus')->insert([
                        'id' => $newId,
                        'tenant_id' => $device->tenant_id,
                        'serial_number' => $sn,
                        'mac_address' => $row['mac_address'] ?? null,
                        'olt_device_id' => $device->id,
                        'pon_port_id' => $row['pon_port_id'] ?? null,
                        'splitter_output_id' => null,
                        'customer_id' => $autoCustomerId,
                        'status' => 'inactive',
                        'is_unlinked' => true,
                        'discovered_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $fiberOnuId = $newId;
                    $linked++;
                } else {
                    $fiberOnuId = $fiberOnuRow->id;
                    $linked++;

                    // Sync signal_strength + status back to fiber_onus (non-destructive)
                    $rx = $row['rx_power'] ?? $row['olt_rx_power'] ?? null;
                    $newSignal = $rx !== null ? (string) $rx : $fiberOnuRow->signal_strength;
                    $liveStatus = $row['status'] ?? null;
                    $mappedStatus = match ($liveStatus) {
                        'online' => 'active',
                        'offline', 'los', 'dying-gasp' => 'inactive',
                        default => $fiberOnuRow->status,
                    };

                    $changes = [];
                    if ($newSignal !== $fiberOnuRow->signal_strength) $changes['signal_strength'] = $newSignal;
                    if ($mappedStatus !== $fiberOnuRow->status) $changes['status'] = $mappedStatus;
                    // Backfill olt_device_id if missing (legacy rows)
                    $changes['olt_device_id'] = $device->id;
                    // Smart linking: backfill customer_id when missing
                    if (empty($fiberOnuRow->customer_id)) {
                        $autoCustomerId = $this->resolveCustomerId($device->tenant_id, $sn, $row['mac_address'] ?? null);
                        if ($autoCustomerId) $changes['customer_id'] = $autoCustomerId;
                    }
                    if (!empty($changes)) {
                        $changes['updated_at'] = $now;
                        \DB::table('fiber_onus')->where('id', $fiberOnuId)->update($changes);
                        $signalSynced++;
                    }
                }
            } catch (\Throwable $e) { /* table may not exist yet */ }

            $payload = [
                'tenant_id' => $device->tenant_id,
                'onu_id' => $fiberOnuId,
                'olt_device_id' => $device->id,
                'serial_number' => $sn,
                'status' => $row['status'] ?? 'unknown',
                'rx_power' => $row['rx_power'] ?? null,
                'tx_power' => $row['tx_power'] ?? null,
                'olt_rx_power' => $row['olt_rx_power'] ?? null,
                'uptime' => $row['uptime'] ?? null,
                'distance_m' => $row['distance_m'] ?? null,
                'last_seen' => $now,
            ];

            $existing = OnuLiveStatus::where('olt_device_id', $device->id)
                ->where('serial_number', $sn)->first();
            $previousStatus = $existing?->status;
            if ($existing) {
                $existing->update($payload);
                $updated++;
            } else {
                OnuLiveStatus::create($payload);
                $inserted++;
            }

            // Phase 10 — Alert Engine evaluation (silent on failure)
            try {
                app(\App\Services\Fiber\OnuAlertEngine::class)->evaluate(
                    $device,
                    $sn,
                    $previousStatus,
                    (string) ($payload['status'] ?? 'unknown'),
                    $payload['rx_power'] !== null ? (float) $payload['rx_power'] : null,
                );
            } catch (\Throwable $e) { /* silent */ }

            // Phase 11 — MikroTik ↔ ONU auto-sync (auto-suspend / auto-restore PPPoE)
            try {
                app(\App\Services\Fiber\OnuMikrotikAutoSync::class)->handle(
                    $device,
                    $sn,
                    $previousStatus,
                    (string) ($payload['status'] ?? 'unknown'),
                );
            } catch (\Throwable $e) { /* silent */ }

            // Phase 9 — Throttled signal history recording.
            // Insert if: no prior point in last 5 minutes OR rx/tx changed by ≥0.5 dB OR status changed.
            try {
                $rxNew = $payload['rx_power'];
                $txNew = $payload['tx_power'];
                $oltRxNew = $payload['olt_rx_power'];
                $statusNew = $payload['status'];
                $last = \DB::table('onu_signal_history')
                    ->where('serial_number', $sn)
                    ->orderByDesc('recorded_at')
                    ->first(['rx_power', 'tx_power', 'olt_rx_power', 'status', 'recorded_at']);
                $shouldRecord = true;
                if ($last) {
                    $ageSec = $now->diffInSeconds(\Carbon\Carbon::parse($last->recorded_at));
                    $rxDelta = ($rxNew !== null && $last->rx_power !== null) ? abs($rxNew - $last->rx_power) : 999;
                    $txDelta = ($txNew !== null && $last->tx_power !== null) ? abs($txNew - $last->tx_power) : 999;
                    $statusChanged = $statusNew !== $last->status;
                    $shouldRecord = $statusChanged || $rxDelta >= 0.5 || $txDelta >= 0.5 || $ageSec >= 300;
                }
                if ($shouldRecord) {
                    \DB::table('onu_signal_history')->insert([
                        'id' => (string) \Str::uuid(),
                        'tenant_id' => $device->tenant_id,
                        'olt_device_id' => $device->id,
                        'serial_number' => $sn,
                        'rx_power' => $rxNew,
                        'tx_power' => $txNew,
                        'olt_rx_power' => $oltRxNew,
                        'status' => $statusNew,
                        'recorded_at' => $now,
                    ]);
                }
            } catch (\Throwable $e) { /* table may not exist yet — silent */ }
        }
        return ['updated' => $updated, 'inserted' => $inserted, 'linked' => $linked, 'signal_synced' => $signalSynced];
    }
}
