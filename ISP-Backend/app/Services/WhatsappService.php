<?php

namespace App\Services;

use App\Models\ReminderLog;
use App\Models\SmsSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsappService
{
    public function send(string $to, string $message, ?string $customerId = null, ?string $billId = null): array
    {
        $settings = SmsSetting::withoutGlobalScopes()
            ->whereNull('tenant_id')
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first()
            ?? SmsSetting::withoutGlobalScopes()
                ->orderByDesc('updated_at')
                ->orderByDesc('created_at')
                ->first();

        if (!$settings || !$settings->whatsapp_enabled) {
            return ['success' => false, 'error' => 'WhatsApp disabled'];
        }

        if (!$settings->whatsapp_token || !$settings->whatsapp_phone_id) {
            return ['success' => false, 'error' => 'WhatsApp API not configured'];
        }

        $cleanPhone = preg_replace('/[^0-9]/', '', $to);
        $phone = str_starts_with($cleanPhone, '880') ? $cleanPhone : "880{$cleanPhone}";

        try {
            $response = Http::withToken($settings->whatsapp_token)
                ->post("https://graph.facebook.com/v18.0/{$settings->whatsapp_phone_id}/messages", [
                    'messaging_product' => 'whatsapp',
                    'to' => $phone,
                    'type' => 'text',
                    'text' => ['body' => $message],
                ]);

            $status = $response->ok() ? 'sent' : 'failed';

            ReminderLog::create([
                'phone' => $to,
                'message' => $message,
                'channel' => 'whatsapp',
                'status' => $status,
                'customer_id' => $customerId,
                'bill_id' => $billId,
            ]);

            return ['success' => $response->ok(), 'status' => $status, 'response' => $response->json()];
        } catch (\Exception $e) {
            Log::error('WhatsApp send failed: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
