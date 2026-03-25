<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Support\Facades\DB;

class SalesService
{
    public function __construct(
        protected InventoryService  $inventoryService,
        protected AccountingService $accountingService
    ) {}

    /**
     * Generate next invoice number.
     */
    public function generateInvoiceNumber(): string
    {
        $last = Sale::orderBy('created_at', 'desc')->first();
        if ($last && preg_match('/INV-(\d+)/', $last->invoice_number, $m)) {
            return 'INV-' . str_pad((int) $m[1] + 1, 6, '0', STR_PAD_LEFT);
        }
        return 'INV-000001';
    }

    /**
     * Create a sale with items (auto stock decrease + transaction).
     */
    public function createSale(array $data, array $items, ?string $createdBy = null): Sale
    {
        return DB::transaction(function () use ($data, $items, $createdBy) {
            $subtotal    = 0;
            $totalProfit = 0;

            // Pre-validate stock
            foreach ($items as $item) {
                $product = Product::findOrFail($item['product_id']);
                if ($product->stock_quantity < $item['quantity']) {
                    throw new \Exception("Insufficient stock for '{$product->name}'. Available: {$product->stock_quantity}");
                }
            }

            $discount = $data['discount'] ?? 0;
            $tax      = $data['tax'] ?? 0;

            // Calculate subtotal from items
            foreach ($items as $item) {
                $product   = Product::findOrFail($item['product_id']);
                $unitPrice = $item['unit_price'] ?? $product->selling_price;
                $subtotal += $item['quantity'] * $unitPrice;
            }

            $total = $subtotal - $discount + $tax;
            $paid  = $data['paid_amount'] ?? $total;
            $due   = $total - $paid;

            $sale = Sale::create([
                'invoice_number' => $data['invoice_number'] ?? $this->generateInvoiceNumber(),
                'customer_id'    => $data['customer_id'] ?? null,
                'customer_name'  => $data['customer_name'] ?? null,
                'customer_phone' => $data['customer_phone'] ?? null,
                'sale_date'      => $data['sale_date'] ?? now()->toDateString(),
                'subtotal'       => $subtotal,
                'discount'       => $discount,
                'tax'            => $tax,
                'total'          => $total,
                'paid_amount'    => $paid,
                'due_amount'     => max(0, $due),
                'payment_method' => $data['payment_method'] ?? 'cash',
                'status'         => $due > 0 ? 'partial' : 'completed',
                'notes'          => $data['notes'] ?? null,
                'created_by'     => $createdBy,
            ]);

            // Create items, update stock, calculate profit
            foreach ($items as $item) {
                $product   = Product::findOrFail($item['product_id']);
                $unitPrice = $item['unit_price'] ?? $product->selling_price;
                $costPrice = $product->cost_price;
                $lineTotal = $item['quantity'] * $unitPrice;
                $lineProfit = ($unitPrice - $costPrice) * $item['quantity'];

                SaleItem::create([
                    'sale_id'    => $sale->id,
                    'product_id' => $item['product_id'],
                    'quantity'   => $item['quantity'],
                    'unit_price' => $unitPrice,
                    'cost_price' => $costPrice,
                    'total'      => $lineTotal,
                    'profit'     => $lineProfit,
                ]);

                $totalProfit += $lineProfit;

                // Auto decrease stock
                $this->inventoryService->decreaseStock($item['product_id'], $item['quantity']);
            }

            // Record income transaction
            if ($paid > 0) {
                $this->accountingService->recordIncome([
                    'category'       => 'sale',
                    'amount'         => $paid,
                    'date'           => $sale->sale_date,
                    'description'    => "Sale {$sale->invoice_number}",
                    'reference_type' => 'sale',
                    'reference_id'   => $sale->id,
                    'account_id'     => $data['account_id'] ?? null,
                    'customer_id'    => $data['customer_id'] ?? null,
                    'created_by'     => $createdBy,
                ]);
            }

            return $sale->load('items.product');
        });
    }

    /**
     * Add payment to existing sale.
     */
    public function addPayment(string $saleId, float $amount, ?string $accountId = null, ?string $createdBy = null): Sale
    {
        return DB::transaction(function () use ($saleId, $amount, $accountId, $createdBy) {
            $sale = Sale::findOrFail($saleId);

            $newPaid = $sale->paid_amount + $amount;
            $newDue  = $sale->total - $newPaid;

            $sale->update([
                'paid_amount' => $newPaid,
                'due_amount'  => max(0, $newDue),
                'status'      => $newDue <= 0 ? 'completed' : 'partial',
            ]);

            $this->accountingService->recordIncome([
                'category'       => 'sale',
                'amount'         => $amount,
                'date'           => now()->toDateString(),
                'description'    => "Payment for {$sale->invoice_number}",
                'reference_type' => 'sale',
                'reference_id'   => $sale->id,
                'account_id'     => $accountId,
                'customer_id'    => $sale->customer_id,
                'created_by'     => $createdBy,
            ]);

            return $sale->fresh();
        });
    }

    /**
     * Cancel/return a sale and restore stock.
     */
    public function cancelSale(string $saleId): Sale
    {
        return DB::transaction(function () use ($saleId) {
            $sale = Sale::with('items')->findOrFail($saleId);

            // Restore stock
            foreach ($sale->items as $item) {
                $this->inventoryService->restoreStock($item->product_id, $item->quantity);
            }

            $sale->update(['status' => 'cancelled']);

            return $sale->fresh();
        });
    }

    /**
     * Get sales profit report.
     */
    public function getProfitReport(?string $from = null, ?string $to = null): array
    {
        $from = $from ?? now()->startOfMonth()->toDateString();
        $to   = $to ?? now()->endOfMonth()->toDateString();

        $sales = Sale::with('items')
            ->whereBetween('sale_date', [$from, $to])
            ->where('status', '!=', 'cancelled')
            ->get();

        $totalRevenue = $sales->sum('total');
        $totalCost    = $sales->flatMap->items->sum(fn($i) => $i->cost_price * $i->quantity);
        $totalProfit  = $sales->flatMap->items->sum('profit');

        return [
            'from'          => $from,
            'to'            => $to,
            'total_sales'   => $sales->count(),
            'total_revenue' => (float) $totalRevenue,
            'total_cost'    => (float) $totalCost,
            'total_profit'  => (float) $totalProfit,
            'margin'        => $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 2) : 0,
        ];
    }
}
