<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class ResellerCommission extends Model
{
    use HasUuid;

    protected $table = 'reseller_commissions';

    protected $fillable = [
        'id', 'reseller_id', 'tenant_id', 'month', 'total_billing',
        'commission_rate', 'commission_amount', 'status', 'paid_at',
    ];

    protected $casts = [
        'total_billing' => 'decimal:2',
        'commission_rate' => 'decimal:2',
        'commission_amount' => 'decimal:2',
    ];

    public function reseller()
    {
        return $this->belongsTo(Reseller::class, 'reseller_id');
    }
}
