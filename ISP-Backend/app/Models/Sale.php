<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'sale_no', 'customer_id', 'customer_name', 'customer_phone',
        'sale_date', 'discount', 'tax', 'total', 'paid_amount',
        'payment_method', 'status', 'notes',
    ];

    protected $casts = [
        'discount'    => 'decimal:2',
        'tax'         => 'decimal:2',
        'total'       => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'sale_date'   => 'date',
    ];

    public function items()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
