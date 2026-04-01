<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SmsTransaction extends Model
{
    use HasUuid;

    const UPDATED_AT = null;

    protected $fillable = [
        'id', 'tenant_id', 'amount', 'type',
        'description', 'admin_id', 'balance_after',
    ];

    protected $casts = [
        'amount'        => 'integer',
        'balance_after' => 'integer',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
