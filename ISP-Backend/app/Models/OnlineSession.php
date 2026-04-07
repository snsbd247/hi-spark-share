<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class OnlineSession extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = [
        'id', 'pppoe_username', 'ip_address', 'mac_address', 'uptime',
        'bytes_in', 'bytes_out', 'customer_id', 'router_id',
        'status', 'connected_at', 'last_seen',
    ];

    protected $casts = [
        'bytes_in' => 'integer',
        'bytes_out' => 'integer',
        'connected_at' => 'datetime',
        'last_seen' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function router()
    {
        return $this->belongsTo(MikrotikRouter::class, 'router_id');
    }
}
