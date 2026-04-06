<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SupplierPayment extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'supplier_id', 'purchase_id', 'amount', 'paid_date',
        'payment_method', 'reference', 'notes', 'status',
    ];

    protected $casts = [
        'amount'    => 'decimal:2',
        'paid_date' => 'date',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }
}
