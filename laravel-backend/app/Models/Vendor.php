<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Vendor extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'phone', 'email', 'company', 'address',
        'balance', 'status', 'notes',
    ];

    protected $casts = [
        'balance' => 'decimal:2',
    ];

    public function purchases()
    {
        return $this->hasMany(Purchase::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
