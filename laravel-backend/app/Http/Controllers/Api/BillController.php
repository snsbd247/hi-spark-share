<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Payment;
use App\Services\BillingService;
use Illuminate\Http\Request;

class BillController extends Controller
{
    public function __construct(protected BillingService $billingService) {}

    public function generate(Request $request)
    {
        $request->validate(['month' => 'required|string']);
        $result = $this->billingService->generateMonthlyBills($request->month);
        return response()->json($result);
    }

    public function store(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|uuid|exists:customers,id',
            'month' => 'required|string',
            'amount' => 'required|numeric|min:0',
        ]);

        $bill = $this->billingService->createBill(
            $request->customer_id,
            $request->month,
            $request->amount,
            $request->due_date
        );

        return response()->json($bill, 201);
    }

    public function update(Request $request, string $id)
    {
        $bill = Bill::findOrFail($id);

        if ($request->status === 'paid' && $bill->status !== 'paid') {
            $this->billingService->markBillPaid($bill);
        }

        $bill->update($request->only(['amount', 'status', 'due_date', 'month']));
        return response()->json($bill->fresh());
    }

    public function destroy(string $id)
    {
        Bill::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }
}
