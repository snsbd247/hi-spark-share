<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'type', 'category', 'amount', 'debit', 'credit',
        'date', 'description', 'reference_type', 'reference_id',
        'account_id', 'customer_id', 'vendor_id', 'created_by',
        'journal_ref',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'debit'  => 'decimal:2',
        'credit' => 'decimal:2',
        'date'   => 'date',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
