<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class PaymentGateway extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'gateway_name', 'environment', 'status',
        'app_key', 'app_secret', 'username', 'password',
        'merchant_number', 'base_url', 'last_connected_at',
    ];

    protected $hidden = ['app_secret', 'password'];
}
