<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SmsService;

class SmsBalanceController extends Controller
{
    public function check()
    {
        try {
            $smsService = app(SmsService::class);
            $result = $smsService->checkBalance();

            if (isset($result['error'])) {
                return response()->json(['balance' => null, 'error' => $result['error']]);
            }

            return response()->json([
                'balance' => $result['balance'] ?? null,
                'provider' => 'greenweb',
            ]);
        } catch (\Exception $e) {
            return response()->json(['balance' => null, 'error' => $e->getMessage()]);
        }
    }
}
