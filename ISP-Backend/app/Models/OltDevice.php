<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class OltDevice extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'olt_devices';

    protected $fillable = [
        'id', 'tenant_id', 'fiber_olt_id', 'name', 'ip_address', 'port', 'api_port',
        'username', 'password_encrypted', 'encryption_key_id', 'vendor',
        'connection_type', 'status', 'poll_interval_sec', 'is_active',
        'last_polled_at', 'metadata',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'metadata' => 'array',
        'last_polled_at' => 'datetime',
    ];

    protected $hidden = ['password_encrypted'];
}
