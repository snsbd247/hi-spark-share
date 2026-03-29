<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GenerateBillsRequest;
use App\Http\Requests\StoreBillRequest;
use App\Http\Requests\UpdateBillRequest;
use App\Models\Bill;
use App\Models\Customer;
use App\Services\BillingService;
use App\Services\SmsService;
use Illuminate\Http\Request;

class BillController extends Controller
{
    public function __construct(
        protected BillingService $billingService,
        protected SmsService $smsService
    ) {}

    public function generate(GenerateBillsRequest $request)
    {
        $result = $this->billingService->generateMonthlyBills($request->month);
        return response()->json($result);
    }

    public function store(StoreBillRequest $request)
    {
        $bill = $this->billingService->createBill(
            $request->customer_id,
            $request->month,
            $request->amount,
            $request->due_date
        );

        // Send new customer bill SMS if applicable
        if ($request->get('send_sms', false)) {
            $customer = Customer::find($request->customer_id);
            if ($customer && $customer->phone) {
                try {
                    $this->billingService->sendNewCustomerBillSms($customer, $bill);
                } catch (\Exception $e) {
                    // SMS failure should not block bill creation
                }
            }
        }

        return response()->json($bill, 201);
    }

    public function update(UpdateBillRequest $request, string $id)
    {
        $bill = Bill::findOrFail($id);

        if ($request->status === 'paid' && $bill->status !== 'paid') {
            $this->billingService->markBillPaid($bill);
        }

        $bill->update($request->validated());
        return response()->json($bill->fresh());
    }

    public function destroy(string $id)
    {
        Bill::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /**
     * GET /api/billing/cycle-overview
     * Billing cycle overview grouped by due date status.
     */
    public function cycleOverview(Request $request)
    {
        $month = $request->get('month', now()->format('Y-m'));
        $today = now()->toDateString();

        $bills = Bill::where('month', $month)
            ->with(['customer:id,customer_id,name,phone,area,status,monthly_bill'])
            ->get();

        $paid = $bills->where('status', 'paid');
        $unpaid = $bills->where('status', 'unpaid');

        $overdue = $unpaid->filter(fn($b) => $b->due_date && $b->due_date->lt($today));
        $dueTomorrow = $unpaid->filter(fn($b) => $b->due_date && $b->due_date->isTomorrow());
        $upcoming = $unpaid->filter(fn($b) => $b->due_date && $b->due_date->gt(now()->addDay()));

        return response()->json([
            'month' => $month,
            'summary' => [
                'total'        => $bills->count(),
                'paid'         => $paid->count(),
                'unpaid'       => $unpaid->count(),
                'overdue'      => $overdue->count(),
                'due_tomorrow' => $dueTomorrow->count(),
                'upcoming'     => $upcoming->count(),
                'total_billed' => (float) $bills->sum('amount'),
                'total_paid'   => (float) $paid->sum('amount'),
                'total_due'    => (float) $unpaid->sum('amount'),
            ],
            'paid'         => $paid->values(),
            'overdue'      => $overdue->values(),
            'due_tomorrow' => $dueTomorrow->values(),
            'upcoming'     => $upcoming->values(),
        ]);
    }
}
