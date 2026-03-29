<?php

namespace App\Services;

use App\Models\ReminderLog;
use App\Models\SmsLog;
use App\Models\SmsSetting;
use Illuminate\Support\Facades\Http;

class SmsService
{
    public function send(string $to, string $message, string $smsType, ?string $customerId = null): array
    {
        $settings = SmsSetting::first();
        $token = $settings->api_token ?? config('services.greenweb.token', '');

        if (!$token) {
            return ['success' => false, 'error' => 'SMS API token not configured'];
        }

        // Check if SMS is enabled for this type
        $typeFlags = [
            'bill_generate' => 'sms_on_bill_generate',
            'payment' => 'sms_on_payment',
            'registration' => 'sms_on_registration',
            'suspension' => 'sms_on_suspension',
            'new_customer_bill' => 'sms_on_new_customer_bill',
        ];

        if (isset($typeFlags[$smsType]) && $settings && !$settings->{$typeFlags[$smsType]}) {
            return ['success' => false, 'reason' => "SMS disabled for {$smsType}"];
        }

        // Clean phone
        $cleanPhone = preg_replace('/[^0-9]/', '', $to);
        $phone = str_starts_with($cleanPhone, '88') ? $cleanPhone : "88{$cleanPhone}";

        // Send via GreenWeb
        $gatewayUrl = 'http://api.greenweb.com.bd/api.php';
        try {
            $response = Http::get($gatewayUrl, [
                'token' => $token,
                'to' => $phone,
                'message' => $message,
            ]);

            $responseText = $response->body();
            $status = str_contains($responseText, 'Ok') ? 'sent' : 'failed';
        } catch (\Exception $e) {
            $responseText = $e->getMessage();
            $status = 'failed';
        }

        // Log
        SmsLog::create([
            'phone' => $to,
            'message' => $message,
            'sms_type' => $smsType,
            'status' => $status,
            'response' => $responseText,
            'customer_id' => $customerId,
        ]);

        // Reminder log for billing types
        if (in_array($smsType, ['bill_generate', 'bill_reminder', 'due_date', 'overdue'])) {
            ReminderLog::create([
                'phone' => $to,
                'message' => $message,
                'channel' => 'sms',
                'status' => $status,
                'customer_id' => $customerId,
            ]);
        }

        return ['success' => $status === 'sent', 'status' => $status, 'response' => $responseText];
    }
}
