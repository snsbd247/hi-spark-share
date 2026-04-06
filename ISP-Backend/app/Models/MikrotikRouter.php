<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class MikrotikRouter extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'name', 'ip_address', 'username', 'password',
        'api_port', 'status', 'description',
    ];

    protected $hidden = ['password'];

    protected $casts = ['api_port' => 'integer'];
}
