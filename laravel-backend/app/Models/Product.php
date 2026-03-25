<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'sku', 'category', 'description',
        'cost_price', 'selling_price', 'stock_quantity',
        'low_stock_alert', 'unit', 'is_active',
    ];

    protected $casts = [
        'cost_price'     => 'decimal:2',
        'selling_price'  => 'decimal:2',
        'stock_quantity' => 'integer',
        'low_stock_alert'=> 'integer',
        'is_active'      => 'boolean',
    ];

    public function purchaseItems()
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function isLowStock(): bool
    {
        return $this->stock_quantity <= $this->low_stock_alert;
    }
}
