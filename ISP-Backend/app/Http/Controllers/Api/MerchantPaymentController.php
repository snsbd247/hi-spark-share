<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMerchantPaymentRequest;
use App\Http\Requests\MatchMerchantPaymentRequest;
use App\Models\MerchantPayment;
use App\Models\Bill;
use App\Models\Customer;
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

    public function store(StoreMerchantPaymentRequest $request)
    {
        $mp = MerchantPayment::create($request->only([
            'transaction_id', 'sender_phone', 'amount', 'reference', 'payment_date', 'sms_text',
        ]));

        return response()->json($mp, 201);
    }

    /**
     * POST /api/merchant-payments/import
     */
    public function import(Request $request)
    {
        $request->validate([
            'payments'                  => 'required|array|min:1',
            'payments.*.transaction_id' => 'required|string',
            'payments.*.sender_phone'   => 'required|string',
            'payments.*.amount'         => 'required|numeric|min:0.01',
            'payments.*.payment_date'   => 'required|date',
        ]);

        $imported = 0;
        $skipped = 0;

        foreach ($request->payments as $data) {
            $exists = MerchantPayment::where('transaction_id', $data['transaction_id'])->exists();
            if ($exists) {
                $skipped++;
                continue;
            }

            MerchantPayment::create([
                'transaction_id' => $data['transaction_id'],
                'sender_phone'   => $data['sender_phone'],
                'amount'         => $data['amount'],
                'payment_date'   => $data['payment_date'],
                'reference'      => $data['reference'] ?? null,
                'sms_text'       => $data['sms_text'] ?? null,
                'status'         => 'unmatched',
            ]);
            $imported++;
        }

        return response()->json([
            'success'  => true,
            'imported' => $imported,
            'skipped'  => $skipped,
        ]);
    }

    public function match(MatchMerchantPaymentRequest $request, string $id)
    {
        $mp = MerchantPayment::findOrFail($id);

        $payment = Payment::create([
            'customer_id' => $request->customer_id,
            'bill_id' => $request->bill_id,
            'amount' => $mp->amount,
            'payment_method' => 'merchant',
            'transaction_id' => $mp->transaction_id,
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $mp->update([
            'status' => 'matched',
            'matched_customer_id' => $request->customer_id,
            'matched_bill_id' => $request->bill_id,
        ]);

        // Mark bill as paid
        $bill = Bill::find($request->bill_id);
        if ($bill) {
            $this->billingService->markBillPaid($bill);
        }

        // Customer ledger credit
        $this->ledgerService->addCredit(
            $request->customer_id,
            $mp->amount,
            "Merchant payment matched - {$mp->transaction_id}",
            $payment->id
        );

        // Post to accounting ledger (merchant account)
        $customer = Customer::find($request->customer_id);
        $customerName = $customer ? $customer->name : 'Unknown';
        $this->ledgerService->postMerchantPayment(
            $mp->amount,
            "Merchant Payment - {$customerName} (TrxID: {$mp->transaction_id})",
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

        return response()->json(['success' => true, 'payment' => $payment]);
    }

    /**
     * GET /api/merchant-payments/reports
     */
    public function reports(Request $request)
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to   = $request->get('to', now()->endOfMonth()->toDateString());

        $total = MerchantPayment::whereBetween('payment_date', [$from, $to]);

        $totalAmount  = (float) (clone $total)->sum('amount');
        $totalCount   = (clone $total)->count();
        $matchedCount = (clone $total)->where('status', 'matched')->count();
        $matchedAmount = (float) (clone $total)->where('status', 'matched')->sum('amount');
        $unmatchedCount = (clone $total)->where('status', 'unmatched')->count();
        $unmatchedAmount = (float) (clone $total)->where('status', 'unmatched')->sum('amount');

        // Daily breakdown
        $dailyBreakdown = MerchantPayment::whereBetween('payment_date', [$from, $to])
            ->selectRaw('DATE(payment_date) as date, COUNT(*) as count, SUM(amount) as total')
            ->groupByRaw('DATE(payment_date)')
            ->orderBy('date')
            ->get();

        return response()->json([
            'from'             => $from,
            'to'               => $to,
            'total_amount'     => $totalAmount,
            'total_count'      => $totalCount,
            'matched_count'    => $matchedCount,
            'matched_amount'   => $matchedAmount,
            'unmatched_count'  => $unmatchedCount,
            'unmatched_amount' => $unmatchedAmount,
            'daily_breakdown'  => $dailyBreakdown,
        ]);
    }
}
