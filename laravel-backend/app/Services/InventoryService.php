<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\Log;

class InventoryService
{
    /**
     * Increase stock when products are purchased.
     */
    public function increaseStock(string $productId, int $quantity): Product
    {
        $product = Product::findOrFail($productId);
        $product->increment('stock_quantity', $quantity);
        $product->refresh();

        Log::info("Stock increased: {$product->name} +{$quantity} = {$product->stock_quantity}");

        return $product;
    }

    /**
     * Decrease stock when products are sold.
     * Throws exception if insufficient stock.
     */
    public function decreaseStock(string $productId, int $quantity): Product
    {
        $product = Product::findOrFail($productId);

        if ($product->stock_quantity < $quantity) {
            throw new \Exception("Insufficient stock for '{$product->name}'. Available: {$product->stock_quantity}, Requested: {$quantity}");
        }

        $product->decrement('stock_quantity', $quantity);
        $product->refresh();

        Log::info("Stock decreased: {$product->name} -{$quantity} = {$product->stock_quantity}");

        return $product;
    }

    /**
     * Restore stock (e.g. when a sale is cancelled/returned).
     */
    public function restoreStock(string $productId, int $quantity): Product
    {
        return $this->increaseStock($productId, $quantity);
    }

    /**
     * Reverse a purchase (reduce stock).
     */
    public function reversePurchaseStock(string $productId, int $quantity): Product
    {
        $product = Product::findOrFail($productId);
        $newQty = max(0, $product->stock_quantity - $quantity);
        $product->update(['stock_quantity' => $newQty]);
        $product->refresh();

        return $product;
    }

    /**
     * Get low stock products.
     */
    public function getLowStockProducts()
    {
        return Product::where('is_active', true)
            ->whereColumn('stock_quantity', '<=', 'low_stock_alert')
            ->get();
    }

    /**
     * Get stock summary.
     */
    public function getStockSummary(): array
    {
        $products = Product::where('is_active', true)->get();

        return [
            'total_products'    => $products->count(),
            'total_stock_value' => $products->sum(fn($p) => $p->stock_quantity * $p->cost_price),
            'total_retail_value'=> $products->sum(fn($p) => $p->stock_quantity * $p->selling_price),
            'low_stock_count'   => $products->filter(fn($p) => $p->isLowStock())->count(),
            'out_of_stock'      => $products->where('stock_quantity', 0)->count(),
        ];
    }
}
