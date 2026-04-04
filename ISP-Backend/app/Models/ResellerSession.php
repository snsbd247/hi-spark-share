<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class ResellerSession extends Model
{
    use HasUuid;

    protected $table = 'reseller_sessions';

    protected $fillable = [
        'id', 'reseller_id', 'session_token', 'ip_address', 'browser', 'device_name', 'status',
    ];

    public function reseller()
    {
        return $this->belongsTo(Reseller::class, 'reseller_id');
    }
}
