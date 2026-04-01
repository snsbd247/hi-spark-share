<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SmsWallet extends Model
{
    use HasUuid;

    protected $fillable = ['id', 'tenant_id', 'balance'];

    protected $casts = ['balance' => 'integer'];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Check if wallet has enough balance for N messages.
     */
    public function hasBalance(int $count = 1): bool
    {
        return $this->balance >= $count;
    }

    /**
     * Deduct SMS balance.
     */
    public function deduct(int $count, string $description = 'SMS sent'): bool
    {
        if (!$this->hasBalance($count)) {
            return false;
        }

        $this->decrement('balance', $count);
        $this->refresh();

        SmsTransaction::create([
            'tenant_id'     => $this->tenant_id,
            'amount'        => $count,
            'type'          => 'debit',
            'description'   => $description,
            'balance_after' => $this->balance,
        ]);

        return true;
    }

    /**
     * Add SMS balance (recharge).
     */
    public function recharge(int $amount, string $description = 'Recharge', ?string $adminId = null): void
    {
        $this->increment('balance', $amount);
        $this->refresh();

        SmsTransaction::create([
            'tenant_id'     => $this->tenant_id,
            'amount'        => $amount,
            'type'          => 'credit',
            'description'   => $description,
            'admin_id'      => $adminId,
            'balance_after' => $this->balance,
        ]);
    }
}
