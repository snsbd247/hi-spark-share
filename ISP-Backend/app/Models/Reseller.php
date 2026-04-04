<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Reseller extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'resellers';

    protected $fillable = [
        'id', 'tenant_id', 'name', 'company_name', 'phone', 'email', 'address',
        'user_id', 'password_hash', 'wallet_balance', 'commission_rate', 'default_commission', 'status',
        'allow_all_packages',
    ];

    protected $hidden = ['password_hash'];

    protected $casts = [
        'wallet_balance' => 'decimal:2',
        'commission_rate' => 'decimal:2',
        'default_commission' => 'decimal:2',
        'allow_all_packages' => 'boolean',
    ];

    public function customers()
    {
        return $this->hasMany(Customer::class, 'reseller_id');
    }

    public function assignedPackages()
    {
        return $this->hasMany(ResellerPackage::class, 'reseller_id');
    }

    public function sessions()
    {
        return $this->hasMany(ResellerSession::class, 'reseller_id');
    }

    public function walletTransactions()
    {
        return $this->hasMany(ResellerWalletTransaction::class, 'reseller_id');
    }

    public function commissions()
    {
        return $this->hasMany(ResellerCommission::class, 'reseller_id');
    }

    public function zones()
    {
        return $this->hasMany(ResellerZone::class, 'reseller_id');
    }

    public function packageCommissions()
    {
        return $this->hasMany(ResellerPackageCommission::class, 'reseller_id');
    }
}
