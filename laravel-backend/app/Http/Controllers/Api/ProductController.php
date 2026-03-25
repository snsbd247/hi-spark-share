<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(protected InventoryService $inventoryService) {}

    public function index(Request $request)
    {
        $query = Product::query();

        if ($request->has('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('sku', 'like', "%{$s}%");
            });
        }

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->boolean('low_stock')) {
            $query->whereColumn('stock_quantity', '<=', 'low_stock_alert');
        }

        return response()->json(
            $query->orderBy('name')->paginate($request->get('per_page', 50))
        );
    }

    public function show(string $id)
    {
        return response()->json(Product::findOrFail($id));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'           => 'required|string|max:255',
            'sku'            => 'required|string|max:100|unique:products,sku',
            'category'       => 'nullable|string|max:100',
            'cost_price'     => 'required|numeric|min:0',
            'selling_price'  => 'required|numeric|min:0',
            'stock_quantity' => 'nullable|integer|min:0',
            'low_stock_alert'=> 'nullable|integer|min:0',
            'unit'           => 'nullable|string|max:20',
        ]);

        $product = Product::create($request->only([
            'name', 'sku', 'category', 'description',
            'cost_price', 'selling_price', 'stock_quantity',
            'low_stock_alert', 'unit',
        ]));

        return response()->json($product, 201);
    }

    public function update(Request $request, string $id)
    {
        $product = Product::findOrFail($id);

        $request->validate([
            'sku' => "nullable|string|max:100|unique:products,sku,{$id}",
        ]);

        $product->update($request->only([
            'name', 'sku', 'category', 'description',
            'cost_price', 'selling_price', 'stock_quantity',
            'low_stock_alert', 'unit', 'is_active',
        ]));

        return response()->json($product);
    }

    public function destroy(string $id)
    {
        $product = Product::findOrFail($id);
        if ($product->saleItems()->exists() || $product->purchaseItems()->exists()) {
            return response()->json(['error' => 'Cannot delete product with transaction history'], 422);
        }
        $product->delete();
        return response()->json(['success' => true]);
    }

    /**
     * GET /api/products/stock-summary
     */
    public function stockSummary()
    {
        return response()->json($this->inventoryService->getStockSummary());
    }

    /**
     * GET /api/products/low-stock
     */
    public function lowStock()
    {
        return response()->json($this->inventoryService->getLowStockProducts());
    }
}
