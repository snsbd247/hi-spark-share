<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class ProductSerial extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'product_id', 'serial_number', 'status', 'notes',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
