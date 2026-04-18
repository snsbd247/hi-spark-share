<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OnuAlertLog extends Model
{
    use HasUuids;

    protected $table = 'onu_alert_logs';

    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'rule_id', 'olt_device_id', 'serial_number',
        'event_type', 'previous_status', 'current_status', 'rx_power',
        'message', 'channels_sent', 'errors', 'sent_at',
    ];

    protected $casts = [
        'channels_sent' => 'array',
        'errors' => 'array',
        'rx_power' => 'float',
        'sent_at' => 'datetime',
    ];
}
