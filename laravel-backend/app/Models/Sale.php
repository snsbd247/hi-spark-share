<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'invoice_number', 'customer_id',
        'customer_name', 'customer_phone', 'sale_date',
        'subtotal', 'discount', 'tax', 'total',
        'paid_amount', 'due_amount', 'payment_method',
        'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'subtotal'    => 'decimal:2',
        'discount'    => 'decimal:2',
        'tax'         => 'decimal:2',
        'total'       => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount'  => 'decimal:2',
        'sale_date'   => 'date',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(Profile::class, 'created_by');
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class, 'reference_id')
            ->where('reference_type', 'sale');
    }
}
