<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class ReminderLog extends Model
{
    use HasUuid;

    const UPDATED_AT = null;

    protected $fillable = [
        'id', 'phone', 'message', 'channel', 'status',
        'customer_id', 'bill_id',
    ];
}
