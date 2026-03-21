<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class AdminSession extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'admin_id', 'session_token', 'ip_address',
        'browser', 'device_name', 'status',
    ];

    public function profile()
    {
        return $this->belongsTo(Profile::class, 'admin_id');
    }
}
