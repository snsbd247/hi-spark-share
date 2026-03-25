<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Services\PurchaseService;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    public function __construct(protected PurchaseService $purchaseService) {}

    public function index(Request $request)
    {
        $query = Purchase::with(['vendor', 'items.product', 'createdBy']);

        if ($request->has('vendor_id')) {
            $query->where('vendor_id', $request->vendor_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('from') && $request->has('to')) {
            $query->whereBetween('purchase_date', [$request->from, $request->to]);
        }

        return response()->json(
            $query->orderBy('purchase_date', 'desc')->paginate($request->get('per_page', 50))
        );
    }

    public function show(string $id)
    {
        $purchase = Purchase::with(['vendor', 'items.product', 'createdBy'])
            ->findOrFail($id);
        return response()->json($purchase);
    }

    public function store(Request $request)
    {
        $request->validate([
            'vendor_id'             => 'required|uuid|exists:vendors,id',
            'purchase_date'         => 'nullable|date',
            'items'                 => 'required|array|min:1',
            'items.*.product_id'    => 'required|uuid|exists:products,id',
            'items.*.quantity'      => 'required|integer|min:1',
            'items.*.unit_price'    => 'required|numeric|min:0',
            'discount'              => 'nullable|numeric|min:0',
            'tax'                   => 'nullable|numeric|min:0',
            'paid_amount'           => 'nullable|numeric|min:0',
            'payment_method'        => 'nullable|string',
            'account_id'            => 'nullable|uuid|exists:accounts,id',
        ]);

        $admin = $request->get('admin_user');

        $purchase = $this->purchaseService->createPurchase(
            $request->only([
                'vendor_id', 'purchase_date', 'discount', 'tax',
                'paid_amount', 'payment_method', 'notes', 'account_id',
            ]),
            $request->items,
            $admin?->id
        );

        return response()->json($purchase, 201);
    }

    /**
     * POST /api/purchases/{id}/pay
     * Add payment to an existing purchase.
     */
    public function addPayment(Request $request, string $id)
    {
        $request->validate([
            'amount'     => 'required|numeric|min:0.01',
            'account_id' => 'nullable|uuid|exists:accounts,id',
        ]);

        $admin = $request->get('admin_user');

        $purchase = $this->purchaseService->addPayment(
            $id,
            $request->amount,
            $request->account_id,
            $admin?->id
        );

        return response()->json($purchase);
    }

    /**
     * GET /api/purchases/vendor/{vendorId}
     */
    public function vendorHistory(string $vendorId)
    {
        return response()->json(
            $this->purchaseService->vendorPurchaseHistory($vendorId)
        );
    }

    public function destroy(string $id)
    {
        $purchase = Purchase::with('items')->findOrFail($id);

        if ($purchase->status === 'received') {
            return response()->json(['error' => 'Cannot delete a received purchase'], 422);
        }

        $purchase->delete();
        return response()->json(['success' => true]);
    }
}
