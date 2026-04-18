<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class OnuLiveStatus extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'onu_live_status';

    protected $fillable = [
        'id', 'tenant_id', 'onu_id', 'olt_device_id', 'serial_number', 'status',
        'rx_power', 'tx_power', 'olt_rx_power', 'uptime', 'distance_m',
        'last_down_reason', 'last_seen',
    ];

    protected $casts = [
        'rx_power' => 'float',
        'tx_power' => 'float',
        'olt_rx_power' => 'float',
        'last_seen' => 'datetime',
    ];
}
