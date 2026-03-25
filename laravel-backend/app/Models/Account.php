<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Account extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'type', 'code', 'balance',
        'description', 'is_system', 'is_active',
    ];

    protected $casts = [
        'balance'   => 'decimal:2',
        'is_system' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
