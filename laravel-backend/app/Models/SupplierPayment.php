<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SupplierPayment extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'supplier_id', 'amount', 'payment_date',
        'payment_method', 'reference', 'note', 'status',
    ];

    protected $casts = [
        'amount'       => 'decimal:2',
        'payment_date' => 'date',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
