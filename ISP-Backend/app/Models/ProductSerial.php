<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ProductSerial extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'product_id', 'serial_number', 'status', 'notes',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
