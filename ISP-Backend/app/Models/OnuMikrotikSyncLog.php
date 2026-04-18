<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class OnuMikrotikSyncLog extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'onu_mikrotik_sync_logs';

    protected $fillable = [
        'id', 'tenant_id', 'customer_id', 'olt_device_id', 'serial_number',
        'pppoe_username', 'action', 'trigger_event', 'previous_status',
        'current_status', 'success', 'message', 'executed_at',
    ];

    protected $casts = [
        'success' => 'boolean',
        'executed_at' => 'datetime',
    ];

    public $timestamps = false;
}
