<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class PaymentGateway extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'gateway_name', 'environment', 'status',
        'app_key', 'app_secret', 'username', 'password',
        'merchant_number', 'base_url', 'receiving_account_id',
        'last_connected_at',
    ];

    protected $hidden = ['app_secret', 'password'];
}
