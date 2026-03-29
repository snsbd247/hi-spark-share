<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'type', 'description', 'debit', 'credit',
        'date', 'account_id', 'created_by',
    ];

    protected $casts = [
        'debit'  => 'decimal:2',
        'credit' => 'decimal:2',
        'date'   => 'datetime',
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
