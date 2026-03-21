<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class AdminLoginLog extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = [
        'id', 'admin_id', 'action', 'ip_address',
        'browser', 'device_name', 'session_id', 'created_at',
    ];

    protected $casts = ['created_at' => 'datetime'];
}
