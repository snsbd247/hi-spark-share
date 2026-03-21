<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BkashService;
use Illuminate\Http\Request;

class BkashController extends Controller
{
    public function __construct(protected BkashService $bkashService) {}

    public function createPayment(Request $request)
    {
        $request->validate([
            'bill_id' => 'required|uuid|exists:bills,id',
            'customer_id' => 'required|uuid|exists:customers,id',
            'amount' => 'required|numeric|min:1',
        ]);

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
