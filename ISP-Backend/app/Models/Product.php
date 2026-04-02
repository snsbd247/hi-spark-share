<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'sku', 'category', 'category_id', 'description',
        'buy_price', 'sell_price', 'stock', 'unit', 'status',
        'brand', 'model',
    ];

    protected $casts = [
        'buy_price'  => 'decimal:2',
        'sell_price' => 'decimal:2',
        'stock'      => 'integer',
    ];

    public function categoryRef()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function serials()
    {
        return $this->hasMany(ProductSerial::class);
    }

    public function purchaseItems()
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function devices()
    {
        return $this->hasMany(CustomerDevice::class);
    }

    public function inventoryLogs()
    {
        return $this->hasMany(InventoryLog::class);
    }
}
