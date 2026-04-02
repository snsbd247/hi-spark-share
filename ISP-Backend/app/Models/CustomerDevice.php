<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class CustomerDevice extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'customer_id', 'product_id', 'serial_number',
        'mac_address', 'ip_address', 'assigned_at', 'status', 'notes',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
