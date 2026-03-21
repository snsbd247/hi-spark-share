<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class MikrotikRouter extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'ip_address', 'username', 'password',
        'api_port', 'status', 'description',
    ];

    protected $hidden = ['password'];

    protected $casts = ['api_port' => 'integer'];
}
