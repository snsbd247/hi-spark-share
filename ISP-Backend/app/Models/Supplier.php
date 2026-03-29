<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'company', 'phone', 'email',
        'address', 'total_due', 'status',
    ];

    protected $casts = [
        'total_due' => 'decimal:2',
    ];

    public function payments()
    {
        return $this->hasMany(SupplierPayment::class);
    }

    public function purchases()
    {
        return $this->hasMany(Purchase::class);
    }
}
