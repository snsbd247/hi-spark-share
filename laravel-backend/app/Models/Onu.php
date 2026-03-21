<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Onu extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'serial_number', 'mac_address', 'olt_id', 'olt_port',
        'customer_id', 'status', 'signal_strength',
    ];

    public function olt()
    {
        return $this->belongsTo(Olt::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
