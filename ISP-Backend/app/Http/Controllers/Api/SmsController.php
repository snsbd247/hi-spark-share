<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SendSmsRequest;
use App\Http\Requests\SendBulkSmsRequest;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SmsController extends Controller
{
    public function __construct(protected SmsService $smsService) {}

    public function send(SendSmsRequest $request)
    {
        try {
            $result = $this->smsService->send(
                $request->phone ?? $request->to,
                $request->message,
                $request->sms_type ?? 'manual',
                $request->customer_id
            );

            // NEVER return fake success — pass through real API result
            $statusCode = ($result['success'] ?? false) ? 200 : 422;

            return response()->json($result, $statusCode);
        } catch (\Exception $e) {
            Log::error('[SMS] Controller exception: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    public function sendBulk(SendBulkSmsRequest $request)
    {
        try {
            if ($request->has('recipients')) {
                // New format: array of {phone, message, customer_id}
                $results = [];
                $sent = 0;
                $failed = 0;
                foreach ($request->recipients as $recipient) {
                    $result = $this->smsService->send(
                        $recipient['phone'],
                        $recipient['message'],
                        'bulk',
                        $recipient['customer_id'] ?? null
                    );
                    $results[] = $result;
                    if ($result['success'] ?? false) $sent++;
                    else $failed++;
                }
                return response()->json([
                    'success' => $sent > 0,
                    'sent'    => $sent,
                    'failed'  => $failed,
                    'total'   => count($results),
                ]);
            }

            // Legacy format: phones array + single message
            $results = $this->smsService->sendBulk(
                $request->phones,
                $request->message,
                'bulk'
            );

            return response()->json([
                'success' => ($results['sent'] ?? 0) > 0,
                'sent'    => $results['sent'] ?? 0,
                'failed'  => $results['failed'] ?? 0,
                'total'   => $results['total'] ?? 0,
            ]);
        } catch (\Exception $e) {
            Log::error('[SMS] Bulk send exception: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    public function balance()
    {
        try {
            $result = $this->smsService->checkBalance();
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
