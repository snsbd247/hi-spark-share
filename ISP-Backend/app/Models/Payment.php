<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'customer_id', 'bill_id', 'amount', 'payment_method',
        'status', 'transaction_id', 'bkash_payment_id', 'bkash_trx_id',
        'month', 'paid_at', 'collected_by', 'reseller_id', 'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function bill()
    {
        return $this->belongsTo(Bill::class);
    }

    public function reseller()
    {
        return $this->belongsTo(Reseller::class);
    }
}
