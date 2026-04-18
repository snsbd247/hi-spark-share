<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class OltPollingLog extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'olt_polling_logs';
    public $timestamps = false;

    protected $fillable = [
        'id', 'tenant_id', 'olt_device_id', 'connection_mode', 'command',
        'status', 'duration_ms', 'onu_count', 'response', 'error_message', 'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
