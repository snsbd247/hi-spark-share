<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Bill extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'customer_id', 'month', 'amount', 'status',
        'due_date', 'paid_date', 'payment_link_token',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'due_date' => 'date',
        'paid_date' => 'date',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }
}
