<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'expense_number', 'category', 'amount', 'expense_date',
        'description', 'payment_method', 'account_id', 'vendor_id',
        'receipt_url', 'status', 'created_by', 'approved_by',
    ];

    protected $casts = [
        'amount'       => 'decimal:2',
        'expense_date' => 'date',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(Profile::class, 'created_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(Profile::class, 'approved_by');
    }
}
