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
        $now = Carbon::now();
        foreach ($onus as $row) {
            $sn = (string) ($row['serial_number'] ?? '');
            if ($sn === '') continue;

            // Loose link to existing fiber_onus
            $fiberOnuId = null;
            try {
                $fiberOnuId = \DB::table('fiber_onus')
                    ->where('serial_number', $sn)
                    ->when($device->tenant_id, fn($q) => $q->where('tenant_id', $device->tenant_id))
                    ->value('id');
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
            if ($existing) {
                $existing->update($payload);
                $updated++;
            } else {
                OnuLiveStatus::create($payload);
                $inserted++;
            }
        }
        return ['updated' => $updated, 'inserted' => $inserted];
    }
}
