<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'category', 'amount', 'date',
        'description', 'payment_method', 'account_id',
        'reference', 'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'date'   => 'date',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }
}
