<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SmsSetting extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'api_token', 'sender_id',
        'sms_on_bill_generate', 'sms_on_payment', 'sms_on_registration', 'sms_on_suspension',
        'sms_on_reminder', 'sms_on_new_customer_bill',
        'whatsapp_enabled', 'whatsapp_token', 'whatsapp_phone_id',
    ];

    protected $hidden = ['api_token', 'whatsapp_token'];

    protected $casts = [
        'sms_on_bill_generate' => 'boolean',
        'sms_on_payment' => 'boolean',
        'sms_on_registration' => 'boolean',
        'sms_on_suspension' => 'boolean',
        'sms_on_reminder' => 'boolean',
        'sms_on_new_customer_bill' => 'boolean',
        'whatsapp_enabled' => 'boolean',
    ];
}
