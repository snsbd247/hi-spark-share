<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ReminderLog extends Model
{
    use HasUuid, BelongsToTenant;

    const UPDATED_AT = null;

    protected $fillable = [
        'id', 'tenant_id', 'phone', 'message', 'channel', 'status',
        'customer_id', 'bill_id',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function bill()
    {
        return $this->belongsTo(Bill::class);
    }
}
