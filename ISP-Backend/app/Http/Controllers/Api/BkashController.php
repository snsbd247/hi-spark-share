<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreatePaymentGatewayRequest;
use App\Services\BkashService;
use Illuminate\Http\Request;

class BkashController extends Controller
{
    public function __construct(protected BkashService $bkashService) {}

    public function createPayment(CreatePaymentGatewayRequest $request)
    {
        $result = $this->bkashService->createPayment(
            $request->bill_id,
            $request->customer_id,
            $request->amount,
            $request->get('callback_url', url('/api/bkash/callback'))
        );

        return response()->json($result);
    }

    public function callback(Request $request)
    {
        $result = $this->bkashService->executePayment(
            $request->paymentID,
            $request->status
        );

        return response()->json($result);
    }

    public function refund(Request $request)
    {
        $request->validate([
            'paymentID' => 'required|string',
            'trxID' => 'required|string',
            'amount' => 'required|numeric|min:1',
            'reason' => 'nullable|string|max:255',
        ]);

        $result = $this->bkashService->refundPayment(
            $request->paymentID,
            $request->trxID,
            (float) $request->amount,
            $request->reason
        );

        return response()->json($result);
    }

    public function queryTransaction(Request $request)
    {
        $request->validate(['paymentID' => 'required|string']);

        $result = $this->bkashService->queryTransaction($request->paymentID);

        return response()->json($result);
    }

    public function testConnection()
    {
        $result = $this->bkashService->testConnection();
        return response()->json($result);
    }
}
