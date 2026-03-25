<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Services\SalesService;
use Illuminate\Http\Request;

class SalesController extends Controller
{
    public function __construct(protected SalesService $salesService) {}

    public function index(Request $request)
    {
        $query = Sale::with(['customer', 'items.product', 'createdBy']);

        if ($request->has('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('from') && $request->has('to')) {
            $query->whereBetween('sale_date', [$request->from, $request->to]);
        }

        return response()->json(
            $query->orderBy('sale_date', 'desc')->paginate($request->get('per_page', 50))
        );
    }

    public function show(string $id)
    {
        $sale = Sale::with(['customer', 'items.product', 'createdBy'])
            ->findOrFail($id);
        return response()->json($sale);
    }

    public function store(Request $request)
    {
        $request->validate([
            'customer_id'           => 'nullable|uuid|exists:customers,id',
            'customer_name'         => 'nullable|string|max:255',
            'customer_phone'        => 'nullable|string|max:20',
            'sale_date'             => 'nullable|date',
            'items'                 => 'required|array|min:1',
            'items.*.product_id'    => 'required|uuid|exists:products,id',
            'items.*.quantity'      => 'required|integer|min:1',
            'items.*.unit_price'    => 'nullable|numeric|min:0',
            'discount'              => 'nullable|numeric|min:0',
            'tax'                   => 'nullable|numeric|min:0',
            'paid_amount'           => 'nullable|numeric|min:0',
            'payment_method'        => 'nullable|string',
            'account_id'            => 'nullable|uuid|exists:accounts,id',
        ]);

        $admin = $request->get('admin_user');

        try {
            $sale = $this->salesService->createSale(
                $request->only([
                    'customer_id', 'customer_name', 'customer_phone',
                    'sale_date', 'discount', 'tax', 'paid_amount',
                    'payment_method', 'notes', 'account_id',
                ]),
                $request->items,
                $admin?->id
            );

            return response()->json($sale, 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/sales/{id}/pay
     */
    public function addPayment(Request $request, string $id)
    {
        $request->validate([
            'amount'     => 'required|numeric|min:0.01',
            'account_id' => 'nullable|uuid|exists:accounts,id',
        ]);

        $admin = $request->get('admin_user');

        $sale = $this->salesService->addPayment(
            $id,
            $request->amount,
            $request->account_id,
            $admin?->id
        );

        return response()->json($sale);
    }

    /**
     * POST /api/sales/{id}/cancel
     */
    public function cancel(string $id)
    {
        try {
            $sale = $this->salesService->cancelSale($id);
            return response()->json($sale);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * GET /api/sales/profit-report
     */
    public function profitReport(Request $request)
    {
        return response()->json(
            $this->salesService->getProfitReport($request->from, $request->to)
        );
    }

    public function destroy(string $id)
    {
        $sale = Sale::findOrFail($id);
        if ($sale->status === 'completed') {
            return response()->json(['error' => 'Cannot delete completed sale. Cancel it first.'], 422);
        }
        $sale->delete();
        return response()->json(['success' => true]);
    }
}
