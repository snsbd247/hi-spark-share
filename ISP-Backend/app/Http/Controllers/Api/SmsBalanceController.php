<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmsSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsBalanceController extends Controller
{
    /**
     * Check GreenWeb API balance, expiry & rate.
     * Returns the same JSON shape the Supabase edge function returns,
     * so the React frontend works identically on both Lovable & VPS.
     */
    public function check()
    {
        try {
            $token = $this->resolveToken();

            if (!$token) {
                return response()->json([
                    'error' => 'SMS API token not configured. Go to SMS Settings to add your GreenWeb API token.',
                ], 400);
            }

            // ── Fetch balance + expiry + rate (JSON) ─────────────
            $balanceUrl = "http://api.greenweb.com.bd/g_api.php?token={$token}&balance&expiry&rate&json";

            $response = Http::timeout(15)->get($balanceUrl);
            $rawText  = $response->body();

            Log::info("[SmsBalance] GreenWeb raw response: {$rawText}");

            $balanceData = null;
            try {
                $balanceData = json_decode($rawText, true);
            } catch (\Exception $e) {
                // not JSON — treat raw text as balance
            }

            // Normalise into an array (strip token for security)
            if (is_array($balanceData)) {
                $items = isset($balanceData[0]) ? $balanceData : [$balanceData];
                $items = array_map(function ($item) {
                    unset($item['token']);
                    return $item;
                }, $items);
            } else {
                // Plain-text fallback
                $items = [['balance' => trim($rawText)]];
            }

            // ── Fetch total sent via tokensms endpoint ───────────
            $totalSent = 0;
            try {
                $statsUrl = "http://api.greenweb.com.bd/g_api.php?token={$token}&tokensms";
                $statsRes = Http::timeout(15)->get($statsUrl);
                $statsText = $statsRes->body();
                Log::info("[SmsBalance] GreenWeb tokensms response: {$statsText}");

                $parsed = intval(trim($statsText));
                if ($parsed > 0) {
                    $totalSent = $parsed;
                } else {
                    $decoded = json_decode($statsText, true);
                    if (is_array($decoded)) {
                        $totalSent = $decoded['total_sms'] ?? $decoded['tokensms'] ?? $decoded['sent'] ?? $decoded['count'] ?? 0;
                    }
                }
            } catch (\Exception $e) {
                Log::warning("[SmsBalance] tokensms fetch failed: " . $e->getMessage());
            }

            return response()->json([
                'balance'    => $items,
                'total_sent' => $totalSent,
            ]);
        } catch (\Exception $e) {
            Log::error("[SmsBalance] Exception: " . $e->getMessage());
            return response()->json([
                'balance'    => [],
                'total_sent' => 0,
                'error'      => $e->getMessage(),
            ]);
        }
    }

    private function resolveToken(): ?string
    {
        // Try DB settings first, then env fallback
        $settings = SmsSetting::query()->latest('updated_at')->first();
        $token = $settings?->api_token;

        if (!$token) {
            $token = config('services.greenweb.token', '');
        }

        return $token ?: null;
    }
}
