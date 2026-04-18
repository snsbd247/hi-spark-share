<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class OnuSignalHistory extends Model
{
    use HasUuid;

    protected $table = 'onu_signal_history';
    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'olt_device_id', 'serial_number',
        'rx_power', 'tx_power', 'olt_rx_power', 'status', 'recorded_at',
    ];

    protected $casts = [
        'rx_power' => 'float',
        'tx_power' => 'float',
        'olt_rx_power' => 'float',
        'recorded_at' => 'datetime',
    ];
}
