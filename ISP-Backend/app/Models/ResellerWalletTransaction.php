<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class ResellerWalletTransaction extends Model
{
    use HasUuid;

    protected $table = 'reseller_wallet_transactions';

    protected $fillable = [
        'id', 'reseller_id', 'tenant_id', 'type', 'amount', 'balance_after', 'description', 'reference',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'balance_after' => 'decimal:2',
    ];

    public function reseller()
    {
        return $this->belongsTo(Reseller::class, 'reseller_id');
    }
}
