<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreatePaymentGatewayRequest;
use App\Services\NagadService;
use Illuminate\Http\Request;

class NagadController extends Controller
{
    public function __construct(protected NagadService $nagadService) {}

    public function createPayment(CreatePaymentGatewayRequest $request)
    {
        $result = $this->nagadService->createPayment(
            $request->bill_id,
            $request->customer_id,
            $request->amount,
            $request->get('callback_url', url('/api/nagad/callback'))
        );

        return response()->json($result);
    }

    public function callback(Request $request)
    {
        $result = $this->nagadService->verifyPayment($request->all());
        return response()->json($result);
    }
}
