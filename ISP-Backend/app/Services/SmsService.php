<?php

namespace App\Services;

use App\Models\ReminderLog;
use App\Models\SmsLog;
use App\Models\SmsSetting;
use App\Models\SuperAdmin;
use App\Models\SmsWallet;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    /**
     * Send SMS using the GLOBAL SMS API config (Super Admin managed).
     * Checks tenant wallet balance before sending.
     * NEVER returns fake success — always validates real API response.
     */
    public function send(string $to, string $message, string $smsType = 'manual', ?string $customerId = null): array
    {
        $settings = $this->resolveSettings();
        $token = $settings?->api_token ?? config('services.greenweb.token', '');

        if (!$token) {
            Log::error('[SMS] No API token configured by Super Admin');
            return ['success' => false, 'error' => 'SMS API token not configured by Super Admin'];
        }

        // Check if SMS is enabled for this type
        $typeFlags = [
            'bill_generate'     => 'sms_on_bill_generate',
            'payment'           => 'sms_on_payment',
            'registration'      => 'sms_on_registration',
            'suspension'        => 'sms_on_suspension',
            'new_customer_bill' => 'sms_on_new_customer_bill',
        ];

        if (isset($typeFlags[$smsType]) && $settings && !$settings->{$typeFlags[$smsType]}) {
            return ['success' => false, 'reason' => "SMS disabled for {$smsType}"];
        }

        // ── Tenant Balance Check ──────────────────────────
        $tenantId = tenant_id();
        $smsCount = $this->calculateSmsCount($message);

        if ($tenantId) {
            $wallet = SmsWallet::firstOrCreate(
                ['tenant_id' => $tenantId],
                ['balance' => 0]
            );

            if (!$wallet->hasBalance($smsCount)) {
                Log::warning("[SMS] Insufficient balance for tenant {$tenantId}. Required: {$smsCount}, Available: {$wallet->balance}");

                SmsLog::create([
                    'phone'       => $to,
                    'message'     => $message,
                    'sms_type'    => $smsType,
                    'status'      => 'failed',
                    'response'    => 'Insufficient SMS balance',
                    'customer_id' => $customerId,
                    'tenant_id'   => $tenantId,
                    'sms_count'   => $smsCount,
                ]);

                return [
                    'success'  => false,
                    'error'    => 'Insufficient SMS balance. Please contact Super Admin to recharge.',
                    'balance'  => $wallet->balance,
                    'required' => $smsCount,
                ];
            }
        }

        // ── Clean phone number (Bangladesh format) ────────
        $cleanPhone = preg_replace('/[^0-9]/', '', $to);
        $phone = str_starts_with($cleanPhone, '88') ? $cleanPhone : "88{$cleanPhone}";

        // ── REAL API CALL to GreenWeb ─────────────────────
        $gatewayUrl = 'http://api.greenweb.com.bd/api.php';
        $responseText = '';
        $status = 'failed';

        try {
            Log::info("[SMS] Sending to {$phone} via GreenWeb API", [
                'sms_type' => $smsType,
                'message_length' => mb_strlen($message),
                'sms_count' => $smsCount,
            ]);

            $response = Http::timeout(30)->get($gatewayUrl, [
                'token'   => $token,
                'to'      => $phone,
                'message' => $message,
            ]);

            $responseText = $response->body();

            Log::info("[SMS] GreenWeb raw response: \"{$responseText}\"");

            // GreenWeb returns "Ok: <number>" on success
            // Any other response = failure
            if ($responseText && str_starts_with(strtolower(trim($responseText)), 'ok')) {
                $status = 'sent';
            } else {
                $status = 'failed';
                Log::error("[SMS] GreenWeb API returned non-success: \"{$responseText}\"");
            }
        } catch (\Exception $e) {
            $responseText = $e->getMessage();
            $status = 'failed';
            Log::error("[SMS] GreenWeb API exception: {$responseText}");
        }

        // ── Deduct balance ONLY on confirmed success ──────
        if ($status === 'sent' && $tenantId && isset($wallet)) {
            $wallet->deduct($smsCount, "SMS to {$to} ({$smsType})");
        }

        // ── Log with REAL status ──────────────────────────
        SmsLog::create([
            'phone'       => $to,
            'message'     => $message,
            'sms_type'    => $smsType,
            'status'      => $status,
            'response'    => $responseText,
            'customer_id' => $customerId,
            'tenant_id'   => $tenantId,
            'sms_count'   => $smsCount,
        ]);

        // Reminder log for billing types
        if (in_array($smsType, ['bill_generate', 'bill_reminder', 'due_date', 'overdue', 'new_customer_bill'])) {
            ReminderLog::create([
                'phone'       => $to,
                'message'     => $message,
                'channel'     => 'sms',
                'status'      => $status,
                'customer_id' => $customerId,
            ]);
        }

        $result = [
            'success'  => $status === 'sent',
            'status'   => $status,
            'response' => $responseText,
        ];

        // Include error message for failed sends
        if ($status === 'failed') {
            $result['error'] = "SMS delivery failed: {$responseText}";
        }

        if ($tenantId && isset($wallet)) {
            $wallet->refresh();
            $result['remaining_balance'] = $wallet->balance;
        }

        Log::info("[SMS] Final result: success=" . ($result['success'] ? 'true' : 'false') . ", status={$status}");

        return $result;
    }

    /**
     * Send bulk SMS (for queue-based processing)
     */
    public function sendBulk(array $phones, string $message, string $smsType = 'bulk'): array
    {
        $results = [];
        $sent = 0;
        $failed = 0;

        foreach ($phones as $phone) {
            $result = $this->send($phone, $message, $smsType);
            $results[] = $result;
            if ($result['success']) {
                $sent++;
            } else {
                $failed++;
            }
        }

        return [
            'total'  => count($phones),
            'sent'   => $sent,
            'failed' => $failed,
            'results' => $results,
        ];
    }

    /**
     * Check GreenWeb API balance
     */
    public function checkBalance(): array
    {
        $settings = $this->resolveSettings();
        $token = $settings?->api_token ?? config('services.greenweb.token', '');

        if (!$token) {
            return ['error' => 'No API token configured'];
        }

        try {
            $response = Http::timeout(15)->get('http://api.greenweb.com.bd/api.php', [
                'token' => $token,
                'type'  => 'balance',
            ]);

            return ['balance' => $response->body()];
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    private function resolveSettings(): ?SmsSetting
    {
        $globalSettings = SmsSetting::withoutGlobalScopes()
            ->whereNull('tenant_id')
            ->orderByRaw('CASE WHEN api_token IS NULL OR api_token = \''\' THEN 1 ELSE 0 END')
            ->latest('updated_at')
            ->first()
            ?? SmsSetting::withoutGlobalScopes()
                ->orderByRaw('CASE WHEN tenant_id IS NULL THEN 0 ELSE 1 END')
                ->orderByRaw('CASE WHEN api_token IS NULL OR api_token = \''\' THEN 1 ELSE 0 END')
                ->latest('updated_at')
                ->first();

        if (!$globalSettings) {
            return null;
        }

        if ($globalSettings->tenant_id !== null) {
            $shouldAutoPromote = !tenant_id() || $this->isSuperAdminContext();

            if ($shouldAutoPromote) {
                try {
                    SmsSetting::withoutEvents(function () use ($globalSettings) {
                        $globalSettings->tenant_id = null;
                        $globalSettings->updated_at = now();
                        $globalSettings->save();
                    });
                    $globalSettings->refresh();
                    Log::warning('[SMS] Auto-promoted legacy GreenWeb SMS settings row to global scope', [
                        'sms_settings_id' => $globalSettings->id,
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('[SMS] Failed to auto-promote legacy global SMS settings row: ' . $e->getMessage());
                }
            }
        }

        return $globalSettings;
    }

    private function isSuperAdminContext(): bool
    {
        try {
            $user = auth()->user();

            if (!$user) {
                return false;
            }

            if (($user->is_super_admin ?? false) === true) {
                return true;
            }

            if ($user instanceof SuperAdmin) {
                return in_array($user->role ?? null, ['super_admin', 'superadmin'], true)
                    || empty($user->tenant_id)
                    || !empty($user->username);
            }

            return in_array($user->role ?? null, ['super_admin', 'superadmin'], true);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Calculate how many SMS units a message costs.
     * Standard: 160 chars = 1 SMS, Unicode: 70 chars = 1 SMS
     */
    private function calculateSmsCount(string $message): int
    {
        $length = mb_strlen($message);
        if ($length === 0) return 1;

        // Check if message contains non-ASCII (Unicode/Bangla)
        $isUnicode = preg_match('/[^\x00-\x7F]/', $message);

        if ($isUnicode) {
            return $length <= 70 ? 1 : (int) ceil($length / 67);
        }

        return $length <= 160 ? 1 : (int) ceil($length / 153);
    }
}
