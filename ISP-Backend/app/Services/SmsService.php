<?php

namespace App\Services;

use App\Models\ReminderLog;
use App\Models\SmsLog;
use App\Models\SmsSetting;
use App\Models\SmsWallet;
use Illuminate\Support\Facades\Http;

class SmsService
{
    /**
     * Send SMS using the GLOBAL SMS API config (Super Admin managed).
     * Checks tenant wallet balance before sending.
     */
    public function send(string $to, string $message, string $smsType, ?string $customerId = null): array
    {
        $settings = SmsSetting::first();
        $token = $settings->api_token ?? config('services.greenweb.token', '');

        if (!$token) {
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
                // Log the failed attempt
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
                    'success' => false,
                    'error'   => 'Insufficient SMS balance. Please contact Super Admin to recharge.',
                    'balance' => $wallet->balance,
                    'required' => $smsCount,
                ];
            }
        }

        // ── Send via GreenWeb (Global API) ────────────────
        $cleanPhone = preg_replace('/[^0-9]/', '', $to);
        $phone = str_starts_with($cleanPhone, '88') ? $cleanPhone : "88{$cleanPhone}";

        $gatewayUrl = 'http://api.greenweb.com.bd/api.php';
        try {
            $response = Http::get($gatewayUrl, [
                'token'   => $token,
                'to'      => $phone,
                'message' => $message,
            ]);

            $responseText = $response->body();
            $status = str_contains($responseText, 'Ok') ? 'sent' : 'failed';
        } catch (\Exception $e) {
            $responseText = $e->getMessage();
            $status = 'failed';
        }

        // ── Deduct balance on successful send ─────────────
        if ($status === 'sent' && $tenantId && isset($wallet)) {
            $wallet->deduct($smsCount, "SMS to {$to} ({$smsType})");
        }

        // ── Log ───────────────────────────────────────────
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
        if (in_array($smsType, ['bill_generate', 'bill_reminder', 'due_date', 'overdue'])) {
            ReminderLog::create([
                'phone'       => $to,
                'message'     => $message,
                'channel'     => 'sms',
                'status'      => $status,
                'customer_id' => $customerId,
            ]);
        }

        $result = ['success' => $status === 'sent', 'status' => $status, 'response' => $responseText];

        if ($tenantId && isset($wallet)) {
            $wallet->refresh();
            $result['remaining_balance'] = $wallet->balance;
        }

        return $result;
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
