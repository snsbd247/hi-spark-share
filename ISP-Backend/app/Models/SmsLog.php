<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SmsLog extends Model
{
    use HasUuid;

    const UPDATED_AT = null;

    protected $fillable = [
        'id', 'phone', 'message', 'sms_type', 'status',
        'response', 'customer_id', 'tenant_id', 'sms_count',
    ];
}
