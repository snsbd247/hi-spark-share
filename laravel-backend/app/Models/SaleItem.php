<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'sale_id', 'product_id',
        'quantity', 'unit_price', 'cost_price',
        'total', 'profit',
    ];

    protected $casts = [
        'quantity'   => 'integer',
        'unit_price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'total'      => 'decimal:2',
        'profit'     => 'decimal:2',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
