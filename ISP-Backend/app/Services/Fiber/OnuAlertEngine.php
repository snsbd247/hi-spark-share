<?php

namespace App\Services\Fiber;

use App\Models\OltDevice;
use App\Models\OnuAlertLog;
use App\Models\OnuAlertRule;
use App\Services\EmailService;
use App\Services\SmsService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Phase 10 — ONU Alert Engine.
 * Evaluates ONU status transitions against tenant rules and dispatches Email + SMS.
 * Cooldown-throttled to prevent duplicate alerts.
 */
class OnuAlertEngine
{
    public function __construct(
        protected ?EmailService $email = null,
        protected ?SmsService $sms = null,
    ) {
        $this->email = $email ?: app(EmailService::class);
        $this->sms = $sms ?: app(SmsService::class);
    }

    /**
     * Evaluate one ONU status row against rules.
     * Called from OnuStatusUpdater when status changes or signal degrades.
     */
    public function evaluate(OltDevice $device, string $serial, ?string $previousStatus, string $currentStatus, ?float $rxPower): void
    {
        $event = $this->mapEvent($previousStatus, $currentStatus, $rxPower);
        if (!$event) return;

        try {
            $rules = OnuAlertRule::query()
                ->where('is_active', true)
                ->when($device->tenant_id, fn($q) => $q->where('tenant_id', $device->tenant_id))
                ->where(function ($q) use ($event) {
                    $q->where('event_type', $event)->orWhere('event_type', 'any');
                })
                ->get();
        } catch (\Throwable $e) {
            // Tables not migrated yet — silent
            return;
        }

        foreach ($rules as $rule) {
            // Signal-low guard: only fire if rx below threshold
            if ($event === 'signal_low') {
                $thr = $rule->rx_threshold_db;
                if ($thr === null || $rxPower === null || $rxPower >= $thr) continue;
            }

            // Cooldown — same serial+event within window?
            $cooldownMin = max(1, (int) ($rule->cooldown_minutes ?? 30));
            $recent = OnuAlertLog::where('serial_number', $serial)
                ->where('event_type', $event)
                ->where('rule_id', $rule->id)
                ->where('sent_at', '>=', Carbon::now()->subMinutes($cooldownMin))
                ->exists();
            if ($recent) continue;

            $this->dispatch($device, $rule, $serial, $event, $previousStatus, $currentStatus, $rxPower);
        }
    }

    protected function mapEvent(?string $prev, string $curr, ?float $rx): ?string
    {
        // Only fire on transitions into bad states
        $bad = ['offline', 'los', 'dying-gasp'];
        if (in_array($curr, $bad, true) && $prev !== $curr) {
            return match ($curr) {
                'offline' => 'offline',
                'los' => 'los',
                'dying-gasp' => 'dying_gasp',
                default => null,
            };
        }
        // Signal-low evaluated separately by rule threshold
        if ($curr === 'online' && $rx !== null && $rx <= -25) return 'signal_low';
        return null;
    }

    protected function dispatch(OltDevice $device, OnuAlertRule $rule, string $serial, string $event, ?string $prev, string $curr, ?float $rx): void
    {
        $channels = $rule->channels ?: ['email', 'sms'];
        $subject = "[ONU Alert] {$serial} — " . strtoupper(str_replace('_', ' ', $event));
        $body = sprintf(
            "OLT: %s\nONU Serial: %s\nEvent: %s\nPrevious: %s\nCurrent: %s\nRx Power: %s dBm\nTime: %s",
            $device->name ?? '-',
            $serial,
            $event,
            $prev ?? '-',
            $curr,
            $rx !== null ? (string) $rx : '-',
            now()->toDateTimeString()
        );
        $html = '<pre style="font-family:monospace;font-size:13px;line-height:1.5">' . e($body) . '</pre>';

        $sent = ['email' => false, 'sms' => false];
        $errors = [];

        if (in_array('email', $channels, true) && !empty($rule->recipients_email)) {
            foreach ($rule->recipients_email as $to) {
                try {
                    $r = $this->email->send($to, $subject, $html);
                    if (!empty($r['success'])) {
                        $sent['email'] = true;
                    } else {
                        $errors['email'][] = ($r['error'] ?? 'unknown') . " ({$to})";
                    }
                } catch (\Throwable $e) {
                    $errors['email'][] = $e->getMessage() . " ({$to})";
                }
            }
        }

        if (in_array('sms', $channels, true) && !empty($rule->recipients_sms)) {
            $smsMsg = "ONU Alert: {$serial} {$event} on " . ($device->name ?? 'OLT') . " at " . now()->format('H:i');
            foreach ($rule->recipients_sms as $to) {
                try {
                    $r = $this->sms->send($to, $smsMsg, 'manual');
                    if (!empty($r['success'])) {
                        $sent['sms'] = true;
                    } else {
                        $errors['sms'][] = ($r['error'] ?? $r['reason'] ?? 'unknown') . " ({$to})";
                    }
                } catch (\Throwable $e) {
                    $errors['sms'][] = $e->getMessage() . " ({$to})";
                }
            }
        }

        try {
            OnuAlertLog::create([
                'tenant_id' => $device->tenant_id,
                'rule_id' => $rule->id,
                'olt_device_id' => $device->id,
                'serial_number' => $serial,
                'event_type' => $event,
                'previous_status' => $prev,
                'current_status' => $curr,
                'rx_power' => $rx,
                'message' => $body,
                'channels_sent' => $sent,
                'errors' => $errors ?: null,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('OnuAlertEngine: log insert failed: ' . $e->getMessage());
        }
    }
}
