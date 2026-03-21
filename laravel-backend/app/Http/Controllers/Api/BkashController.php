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
}
