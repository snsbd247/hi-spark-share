<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Vendor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseService
{
    public function __construct(
        protected InventoryService  $inventoryService,
        protected AccountingService $accountingService
    ) {}

    /**
     * Generate next purchase number.
     */
    public function generatePurchaseNumber(): string
    {
        $last = Purchase::orderBy('created_at', 'desc')->first();
        if ($last && preg_match('/PUR-(\d+)/', $last->purchase_number, $m)) {
            return 'PUR-' . str_pad((int) $m[1] + 1, 6, '0', STR_PAD_LEFT);
        }
        return 'PUR-000001';
    }

    /**
     * Create a purchase with items.
     */
    public function createPurchase(array $data, array $items, ?string $createdBy = null): Purchase
    {
        return DB::transaction(function () use ($data, $items, $createdBy) {
            $subtotal = 0;
            foreach ($items as $item) {
                $subtotal += $item['quantity'] * $item['unit_price'];
            }

            $discount = $data['discount'] ?? 0;
            $tax      = $data['tax'] ?? 0;
            $total    = $subtotal - $discount + $tax;
            $paid     = $data['paid_amount'] ?? 0;
            $due      = $total - $paid;

            $purchase = Purchase::create([
                'purchase_number' => $data['purchase_number'] ?? $this->generatePurchaseNumber(),
                'vendor_id'       => $data['vendor_id'],
                'purchase_date'   => $data['purchase_date'] ?? now()->toDateString(),
                'subtotal'        => $subtotal,
                'discount'        => $discount,
                'tax'             => $tax,
                'total'           => $total,
                'paid_amount'     => $paid,
                'due_amount'      => $due,
                'payment_method'  => $data['payment_method'] ?? null,
                'status'          => $due > 0 ? 'partial' : 'received',
                'notes'           => $data['notes'] ?? null,
                'created_by'      => $createdBy,
            ]);

            // Create items & update stock
            foreach ($items as $item) {
                PurchaseItem::create([
                    'purchase_id' => $purchase->id,
                    'product_id'  => $item['product_id'],
                    'quantity'    => $item['quantity'],
                    'unit_price'  => $item['unit_price'],
                    'total'       => $item['quantity'] * $item['unit_price'],
                ]);

                // Auto increase stock
                $this->inventoryService->increaseStock($item['product_id'], $item['quantity']);

                // Update product cost price
                Product::where('id', $item['product_id'])
                    ->update(['cost_price' => $item['unit_price']]);
            }

            // Update vendor balance (increase payable)
            Vendor::where('id', $data['vendor_id'])->increment('balance', $due);

            // Record expense transaction
            if ($paid > 0) {
                $this->accountingService->recordExpense([
                    'category'       => 'purchase',
                    'amount'         => $paid,
                    'date'           => $purchase->purchase_date,
                    'description'    => "Purchase {$purchase->purchase_number}",
                    'reference_type' => 'purchase',
                    'reference_id'   => $purchase->id,
                    'account_id'     => $data['account_id'] ?? null,
                    'vendor_id'      => $data['vendor_id'],
                    'created_by'     => $createdBy,
                ]);
            }

            return $purchase->load('items.product', 'vendor');
        });
    }

    /**
     * Add payment to existing purchase.
     */
    public function addPayment(string $purchaseId, float $amount, ?string $accountId = null, ?string $createdBy = null): Purchase
    {
        return DB::transaction(function () use ($purchaseId, $amount, $accountId, $createdBy) {
            $purchase = Purchase::findOrFail($purchaseId);

            $newPaid = $purchase->paid_amount + $amount;
            $newDue  = $purchase->total - $newPaid;

            $purchase->update([
                'paid_amount' => $newPaid,
                'due_amount'  => max(0, $newDue),
                'status'      => $newDue <= 0 ? 'received' : 'partial',
            ]);

            // Reduce vendor balance
            Vendor::where('id', $purchase->vendor_id)->decrement('balance', $amount);

            // Record payment as expense
            $this->accountingService->recordExpense([
                'category'       => 'purchase',
                'amount'         => $amount,
                'date'           => now()->toDateString(),
                'description'    => "Payment for {$purchase->purchase_number}",
                'reference_type' => 'purchase',
                'reference_id'   => $purchase->id,
                'account_id'     => $accountId,
                'vendor_id'      => $purchase->vendor_id,
                'created_by'     => $createdBy,
            ]);

            return $purchase->fresh();
        });
    }

    /**
     * Get vendor-wise purchase history.
     */
    public function vendorPurchaseHistory(string $vendorId): array
    {
        $purchases = Purchase::where('vendor_id', $vendorId)
            ->with('items.product')
            ->orderBy('purchase_date', 'desc')
            ->get();

        return [
            'vendor'          => Vendor::find($vendorId),
            'purchases'       => $purchases,
            'total_purchases' => $purchases->sum('total'),
            'total_paid'      => $purchases->sum('paid_amount'),
            'total_due'       => $purchases->sum('due_amount'),
        ];
    }
}
