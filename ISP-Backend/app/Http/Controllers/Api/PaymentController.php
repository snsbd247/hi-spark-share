<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePaymentRequest;
use App\Models\Payment;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\SmsTemplate;
use App\Services\BillingService;
use App\Services\LedgerService;
use App\Services\SmsService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected BillingService $billingService,
        protected LedgerService $ledgerService
    ) {}

    public function store(StorePaymentRequest $request)
    {
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

        // Add customer ledger entry
        $this->ledgerService->addCredit(
            $request->customer_id,
            $request->amount,
            "Payment - {$request->payment_method}",
            $payment->id
        );

        // Post to accounting ledger
        $customer = Customer::find($request->customer_id);
        $customerName = $customer ? $customer->name : 'Unknown';
        $this->ledgerService->postServiceIncome(
            $request->amount,
            "Bill Payment - {$customerName} ({$request->payment_method})",
            $payment->id
        );

        // Check if customer should be reactivated
        if ($customer && $customer->status === 'suspended') {
            $totalDue = Bill::where('customer_id', $customer->id)
                ->where('status', 'unpaid')
                ->sum('amount');
            if ($totalDue <= 0) {
                $customer->update(['status' => 'pending_reactivation']);
            }
        }

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
