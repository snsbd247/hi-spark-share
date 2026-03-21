<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class CustomerLedger extends Model
{
    use HasUuid;

    protected $table = 'customer_ledger';

    protected $fillable = [
        'id', 'customer_id', 'date', 'type', 'description',
        'debit', 'credit', 'balance', 'reference',
    ];

    protected $casts = [
        'debit' => 'decimal:2',
        'credit' => 'decimal:2',
        'balance' => 'decimal:2',
        'date' => 'date',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
