<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OnuAlertRule extends Model
{
    use HasUuids;

    protected $table = 'onu_alert_rules';

    protected $fillable = [
        'tenant_id', 'name', 'event_type', 'rx_threshold_db',
        'cooldown_minutes', 'recipients_email', 'recipients_sms',
        'channels', 'is_active',
    ];

    protected $casts = [
        'recipients_email' => 'array',
        'recipients_sms' => 'array',
        'channels' => 'array',
        'is_active' => 'boolean',
        'rx_threshold_db' => 'float',
        'cooldown_minutes' => 'integer',
    ];
}
