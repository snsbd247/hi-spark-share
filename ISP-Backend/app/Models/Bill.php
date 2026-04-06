<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Bill extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'customer_id', 'month', 'amount', 'discount',
        'paid_amount', 'status', 'due_date', 'paid_date', 'payment_link_token',
        'reseller_id', 'base_amount', 'commission_amount', 'reseller_profit',
        'tenant_amount', 'coupon_id',
    ];

    protected $casts = [
        'amount'            => 'decimal:2',
        'discount'          => 'decimal:2',
        'paid_amount'       => 'decimal:2',
        'base_amount'       => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'reseller_profit'   => 'decimal:2',
        'tenant_amount'     => 'decimal:2',
        'due_date'          => 'date',
        'paid_date'         => 'date',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function reseller()
    {
        return $this->belongsTo(Reseller::class);
    }

    public function coupon()
    {
        return $this->belongsTo(Coupon::class);
    }
}
