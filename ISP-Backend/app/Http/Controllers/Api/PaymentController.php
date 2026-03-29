<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePaymentRequest;
use App\Models\Payment;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\CustomerLedger;
use App\Models\SmsTemplate;
use App\Models\Transaction;
use App\Services\BillingService;
use App\Services\LedgerService;
use App\Services\SmsService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected BillingService $billingService,
        protected LedgerService $ledgerService,
        protected SmsService $smsService
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

        // Send Payment Confirmation SMS
        if ($customer && $customer->phone) {
            try {
                $tpl = SmsTemplate::where('name', 'Payment Confirmation')->first();
                $templateMsg = $tpl->message ?? 'Dear {CustomerName}, we received your payment of {Amount} BDT on {PaymentDate}. Thank you!';
                $smsMessage = str_replace(
                    ['{CustomerName}', '{Amount}', '{PaymentDate}', '{Month}', '{CustomerID}'],
                    [$customer->name, $request->amount, now()->format('d/m/Y'), $request->month ?? '', $customer->customer_id],
                    $templateMsg
                );
                $this->smsService->send($customer->phone, $smsMessage, 'payment', $customer->id);
            } catch (\Exception $e) {
                // SMS failure should not block payment
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
        $payment = Payment::findOrFail($id);

        // 1. Remove customer ledger entries for this payment
        CustomerLedger::where('customer_id', $payment->customer_id)
            ->where('type', 'payment')
            ->where('reference', $payment->id)
            ->delete();

        // 2. Remove accounting transactions for this payment
        $ref = $payment->transaction_id ?: "payment-{$payment->payment_method}";
        Transaction::where('reference', $ref)
            ->where('type', 'receipt')
            ->delete();

        // 3. Revert bill status to unpaid if linked
        if ($payment->bill_id) {
            $bill = Bill::find($payment->bill_id);
            if ($bill && $bill->status === 'paid') {
                $bill->update([
                    'status' => 'unpaid',
                    'paid_date' => null,
                ]);
            }
        }

        // 4. Recalculate customer ledger running balance
        $this->ledgerService->recalculateCustomerBalance($payment->customer_id);

        // 5. Delete the payment
        $payment->delete();

        return response()->json(['success' => true]);
    }
}
