<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class AdminSession extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'admin_id', 'session_token', 'ip_address',
        'browser', 'device_name', 'city', 'country',
        'last_activity', 'status',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
