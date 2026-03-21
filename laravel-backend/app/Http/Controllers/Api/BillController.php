<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GenerateBillsRequest;
use App\Http\Requests\StoreBillRequest;
use App\Http\Requests\UpdateBillRequest;
use App\Models\Bill;
use App\Services\BillingService;

class BillController extends Controller
{
    public function __construct(protected BillingService $billingService) {}

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
}
