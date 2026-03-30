<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use Illuminate\Http\Request;

class SupplierController2 extends Controller
{
    public function index(Request $request)
    {
        $query = Supplier::query()->orderBy('name');
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%$s%")
                  ->orWhere('company', 'like', "%$s%")
                  ->orWhere('phone', 'like', "%$s%");
            });
        }
        return response()->json($query->get());
    }

    public function show(string $id)
    {
        $supplier = Supplier::with(['payments', 'purchases.items.product'])->findOrFail($id);

        // Calculate summary
        $totalPurchases = $supplier->purchases->sum('total_amount');
        $totalPaid = $supplier->payments->sum('amount');

        $supplier->total_purchases = $totalPurchases;
        $supplier->total_paid = $totalPaid;
        $supplier->calculated_due = $totalPurchases - $totalPaid;

        return response()->json($supplier);
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string|max:255']);
        $supplier = Supplier::create($request->all());
        return response()->json($supplier, 201);
    }

    public function update(Request $request, string $id)
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->update($request->all());
        return response()->json($supplier);
    }

    public function destroy(string $id)
    {
        Supplier::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Payments ─────────────────────────────────────────

    public function payments(Request $request)
    {
        $query = SupplierPayment::with('supplier')->orderByDesc('paid_date');
        if ($request->has('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }
        return response()->json($query->get());
    }

    public function storePayment(Request $request)
    {
        $request->validate([
            'supplier_id'  => 'required|uuid|exists:suppliers,id',
            'amount'       => 'required|numeric|min:0.01',
            'paid_date'    => 'required|date',
        ]);

        $payment = SupplierPayment::create($request->all());

        // Update supplier balance
        $supplier = Supplier::find($request->supplier_id);
        if ($supplier) {
            $supplier->balance -= $request->amount;
            if ($supplier->total_due !== null) {
                $supplier->total_due = max(0, $supplier->total_due - $request->amount);
            }
            $supplier->save();
        }

        return response()->json($payment->load('supplier'), 201);
    }

    public function deletePayment(string $id)
    {
        $payment = SupplierPayment::findOrFail($id);
        $supplier = Supplier::find($payment->supplier_id);
        if ($supplier) {
            $supplier->balance += $payment->amount;
            if ($supplier->total_due !== null) {
                $supplier->total_due += $payment->amount;
            }
            $supplier->save();
        }
        $payment->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Purchases (supplier-specific) ────────────────────

    public function purchases(Request $request)
    {
        $query = Purchase::with(['supplier', 'items.product'])->orderByDesc('date');
        if ($request->has('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }
        return response()->json($query->get());
    }
}
