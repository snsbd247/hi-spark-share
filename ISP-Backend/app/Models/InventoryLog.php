<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class InventoryLog extends Model
{
    use HasUuid, BelongsToTenant;

    public $timestamps = false;

    protected $fillable = [
        'id', 'tenant_id', 'product_id', 'type', 'quantity', 'note',
        'reference_type', 'reference_id', 'created_at',
    ];

    protected $casts = [
        'quantity'   => 'integer',
        'created_at' => 'datetime',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
