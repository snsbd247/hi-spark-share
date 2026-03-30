<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Purchase extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'purchase_no', 'supplier_id', 'date',
        'total_amount', 'paid_amount', 'status', 'notes',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'paid_amount'  => 'decimal:2',
        'date'         => 'date',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function items()
    {
        return $this->hasMany(PurchaseItem::class);
    }
}
