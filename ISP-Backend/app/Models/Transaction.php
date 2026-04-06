<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'type', 'category', 'amount', 'debit', 'credit',
        'date', 'description', 'reference', 'reference_type', 'reference_id',
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

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }
}
