<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class BillingConfig extends Model
{
    use HasUuid;

    protected $table = 'billing_config';

    protected $fillable = [
        'id', 'config_key', 'config_value', 'description',
    ];
}
