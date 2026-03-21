<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MerchantPayment;
use App\Models\Bill;
use App\Models\Payment;
use App\Services\BillingService;
use App\Services\LedgerService;
use Illuminate\Http\Request;

class MerchantPaymentController extends Controller
{
    public function __construct(
        protected BillingService $billingService,
        protected LedgerService $ledgerService
    ) {}

    public function store(Request $request)
    {
        $request->validate([
            'transaction_id' => 'required|string|unique:merchant_payments,transaction_id',
            'sender_phone' => 'required|string',
            'amount' => 'required|numeric|min:0',
        ]);

        $mp = MerchantPayment::create($request->only([
            'transaction_id', 'sender_phone', 'amount', 'reference', 'payment_date', 'sms_text',
        ]));

        return response()->json($mp, 201);
    }

    public function match(Request $request, string $id)
    {
        $request->validate([
            'bill_id' => 'required|uuid|exists:bills,id',
            'customer_id' => 'required|uuid|exists:customers,id',
        ]);

        $mp = MerchantPayment::findOrFail($id);

        // Create payment record
        $payment = Payment::create([
            'customer_id' => $request->customer_id,
            'bill_id' => $request->bill_id,
            'amount' => $mp->amount,
            'payment_method' => 'merchant',
            'transaction_id' => $mp->transaction_id,
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        // Update merchant payment
        $mp->update([
            'status' => 'matched',
            'matched_customer_id' => $request->customer_id,
            'matched_bill_id' => $request->bill_id,
        ]);

        // Mark bill paid
        $bill = Bill::find($request->bill_id);
        if ($bill) {
            $this->billingService->markBillPaid($bill);
        }

        // Ledger
        $this->ledgerService->addCredit(
            $request->customer_id,
            $mp->amount,
            "Merchant payment matched - {$mp->transaction_id}",
            $payment->id
        );

        return response()->json(['success' => true, 'payment' => $payment]);
    }
}
