<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Account extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'type', 'code', 'parent_id', 'level',
        'balance', 'description', 'is_system', 'is_active',
    ];

    protected $casts = [
        'balance'   => 'decimal:2',
        'is_system' => 'boolean',
        'is_active' => 'boolean',
        'level'     => 'integer',
    ];

    public function parent()
    {
        return $this->belongsTo(Account::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Account::class, 'parent_id');
    }

    public function allChildren()
    {
        return $this->children()->with('allChildren');
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
