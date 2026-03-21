<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Bill;
use App\Services\BillingService;
use App\Services\LedgerService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected BillingService $billingService,
        protected LedgerService $ledgerService
    ) {}

    public function store(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid|exists:customers,id',
            'amount' => 'required|numeric|min:0',
            'payment_method' => 'required|string',
        ]);

        $payment = Payment::create([
            'customer_id' => $request->customer_id,
            'amount' => $request->amount,
            'payment_method' => $request->payment_method,
            'bill_id' => $request->bill_id,
            'transaction_id' => $request->transaction_id,
            'month' => $request->month,
            'status' => $request->get('status', 'completed'),
            'paid_at' => now(),
        ]);

        // Mark bill as paid if linked
        if ($request->bill_id) {
            $bill = Bill::find($request->bill_id);
            if ($bill) {
                $this->billingService->markBillPaid($bill);
            }
        }

        // Add ledger entry
        $this->ledgerService->addCredit(
            $request->customer_id,
            $request->amount,
            "Payment - {$request->payment_method}",
            $payment->id
        );

        return response()->json($payment, 201);
    }

    public function update(Request $request, string $id)
    {
        $payment = Payment::findOrFail($id);
        $payment->update($request->all());
        return response()->json($payment);
    }

    public function destroy(string $id)
    {
        Payment::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }
}
