<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class InventoryLog extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = [
        'id', 'product_id', 'type', 'quantity', 'note',
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
