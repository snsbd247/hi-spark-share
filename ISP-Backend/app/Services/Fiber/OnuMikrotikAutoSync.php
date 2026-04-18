<?php

namespace App\Services\Fiber;

use App\Models\Customer;
use App\Models\OltDevice;
use App\Models\OnuAlertRule;
use App\Models\OnuMikrotikSyncLog;
use App\Services\MikrotikService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Phase 11 — MikroTik ↔ ONU auto-sync.
 *
 * Listens to ONU status transitions (via OnuStatusUpdater) and:
 *  - Auto-disables the linked customer's PPPoE secret on offline / LOS / dying-gasp
 *  - Auto-enables it again on recovery (online), if it was previously auto-suspended
 *
 * Safety:
 *  - Requires at least one active OnuAlertRule with `auto_suspend_pppoe = true`
 *    matching the event (or `event_type = any`)
 *  - 5-minute cooldown per customer/action to prevent rapid flapping
 *  - Only restores customers we ourselves auto-suspended (auto_suspended_by_onu = true)
 */
class OnuMikrotikAutoSync
{
    protected const COOLDOWN_MIN = 5;

    public function __construct(protected ?MikrotikService $mikrotik = null)
    {
        $this->mikrotik = $mikrotik ?: app(MikrotikService::class);
    }

    public function handle(OltDevice $device, string $serial, ?string $previousStatus, string $currentStatus): void
    {
        $event = $this->mapEvent($previousStatus, $currentStatus);
        if (!$event) return;

        // Feature gate — at least one rule must enable auto_suspend_pppoe for this event/tenant.
        try {
            $ruleEnabled = OnuAlertRule::query()
                ->where('is_active', true)
                ->where('auto_suspend_pppoe', true)
                ->when($device->tenant_id, fn($q) => $q->where('tenant_id', $device->tenant_id))
                ->where(function ($q) use ($event) {
                    $q->where('event_type', $event)->orWhere('event_type', 'any');
                })
                ->exists();
        } catch (\Throwable $e) {
            return; // tables not migrated — silent
        }
        if (!$ruleEnabled) return;

        // Resolve linked customer via fiber_onus.serial_number → customer_id
        try {
            $onuRow = DB::table('fiber_onus')
                ->where('serial_number', $serial)
                ->when($device->tenant_id, fn($q) => $q->where('tenant_id', $device->tenant_id))
                ->first(['customer_id']);
        } catch (\Throwable $e) {
            return;
        }
        if (!$onuRow || !$onuRow->customer_id) return;

        $customer = Customer::with('router')->find($onuRow->customer_id);
        if (!$customer || !$customer->pppoe_username || !$customer->router_id) return;

        $action = $event === 'recovered' ? 'enable' : 'disable';

        // Only restore customers we suspended.
        if ($action === 'enable' && !$customer->auto_suspended_by_onu) return;

        // Cooldown
        try {
            $recent = OnuMikrotikSyncLog::where('customer_id', $customer->id)
                ->where('action', $action)
                ->where('executed_at', '>=', Carbon::now()->subMinutes(self::COOLDOWN_MIN))
                ->exists();
            if ($recent) return;
        } catch (\Throwable $e) { /* ignore */ }

        $this->execute($device, $customer, $serial, $action, $event, $previousStatus, $currentStatus);
    }

    protected function mapEvent(?string $prev, string $curr): ?string
    {
        $bad = ['offline', 'los', 'dying-gasp'];
        if (in_array($curr, $bad, true) && $prev !== $curr) {
            return match ($curr) {
                'offline' => 'offline',
                'los' => 'los',
                'dying-gasp' => 'dying_gasp',
                default => null,
            };
        }
        if ($curr === 'online' && in_array($prev, $bad, true)) return 'recovered';
        return null;
    }

    protected function execute(OltDevice $device, Customer $customer, string $serial, string $action, string $event, ?string $prev, string $curr): void
    {
        $success = false;
        $message = null;

        try {
            $result = $action === 'disable'
                ? $this->mikrotik->disablePppoe($customer)
                : $this->mikrotik->enablePppoe($customer);
            $success = (bool) ($result['success'] ?? false);
            $message = $result['message'] ?? ($result['error'] ?? null);
        } catch (\Throwable $e) {
            $message = $e->getMessage();
            Log::warning('OnuMikrotikAutoSync: ' . $action . ' failed', [
                'customer_id' => $customer->id, 'serial' => $serial, 'error' => $message,
            ]);
        }

        if ($success) {
            try {
                if ($action === 'disable') {
                    $customer->update([
                        'auto_suspended_by_onu' => true,
                        'auto_suspended_at' => now(),
                    ]);
                } else {
                    $customer->update([
                        'auto_suspended_by_onu' => false,
                        'auto_suspended_at' => null,
                    ]);
                }
            } catch (\Throwable $e) { /* column may not exist yet */ }
        }

        try {
            OnuMikrotikSyncLog::create([
                'tenant_id' => $device->tenant_id,
                'customer_id' => $customer->id,
                'olt_device_id' => $device->id,
                'serial_number' => $serial,
                'pppoe_username' => $customer->pppoe_username,
                'action' => $action,
                'trigger_event' => $event,
                'previous_status' => $prev,
                'current_status' => $curr,
                'success' => $success,
                'message' => $message,
                'executed_at' => now(),
            ]);
        } catch (\Throwable $e) { /* silent */ }
    }
}
