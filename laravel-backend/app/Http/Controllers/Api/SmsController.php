<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SendSmsRequest;
use App\Http\Requests\SendBulkSmsRequest;
use App\Services\SmsService;
use Illuminate\Http\Request;

class SmsController extends Controller
{
    public function __construct(protected SmsService $smsService) {}

    public function send(SendSmsRequest $request)
    {

        $result = $this->smsService->send(
            $request->to,
            $request->message,
            $request->sms_type,
            $request->customer_id
        );

        return response()->json($result);
    }

    public function sendBulk(Request $request)
    {
        $request->validate([
            'phones' => 'required|array',
            'message' => 'required|string',
        ]);

        $results = [];
        foreach ($request->phones as $phone) {
            $results[] = $this->smsService->send($phone, $request->message, 'bulk');
        }

        return response()->json([
            'success' => true,
            'sent' => count(array_filter($results, fn($r) => $r['success'] ?? false)),
            'total' => count($results),
        ]);
    }
}
