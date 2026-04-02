<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Services\SmsService;
use App\Models\SmsLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MobileSmsController extends Controller
{
    use ApiResponse;

    public function send(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'message' => 'required|string|max:640',
        ]);

        try {
            $sms = app(SmsService::class);
            $result = $sms->send($request->phone, $request->message);

            // Check real API result — don't assume success
            if (!($result['success'] ?? false)) {
                return $this->error(
                    $result['error'] ?? $result['response'] ?? 'SMS delivery failed',
                    422
                );
            }

            return $this->success($result, 'SMS sent');
        } catch (\Exception $e) {
            Log::error('[MobileSMS] Send error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 422);
        }
    }

    public function sendBulk(Request $request)
    {
        $request->validate([
            'phones' => 'required|array|min:1',
            'phones.*' => 'string',
            'message' => 'required|string|max:640',
        ]);

        try {
            $sms = app(SmsService::class);
            $result = $sms->sendBulk($request->phones, $request->message);
            return $this->success($result, 'Bulk SMS processed');
        } catch (\Exception $e) {
            Log::error('[MobileSMS] Bulk send error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 422);
        }
    }

    public function balance()
    {
        try {
            $sms = app(SmsService::class);
            $balance = $sms->checkBalance();
            return $this->success($balance, 'SMS balance');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    public function logs(Request $request)
    {
        $query = SmsLog::orderBy('created_at', 'desc');

        if ($phone = $request->input('phone')) {
            $query->where('recipients', 'like', "%{$phone}%");
        }

        return $this->paginated($query, $request->input('per_page', 20), 'SMS logs');
    }
}
