<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    use HasUuid;

    protected $fillable = [
        'name', 'subdomain', 'email', 'phone',
        'logo_url', 'status', 'plan',
        'trial_ends_at', 'settings',
        'max_users', 'max_customers',
        'plan_expire_date', 'grace_days', 'plan_id', 'plan_expiry_message',
        'setup_status', 'setup_payment_gateways', 'setup_accounts',
        'setup_geo', 'setup_ledger', 'setup_templates', 'auto_setup',
    ];

    protected $casts = [
        'settings' => 'array',
        'trial_ends_at' => 'datetime',
        'setup_payment_gateways' => 'boolean',
        'setup_accounts' => 'boolean',
        'setup_geo' => 'boolean',
        'setup_ledger' => 'boolean',
        'setup_templates' => 'boolean',
        'auto_setup' => 'boolean',
    ];

    public function domains()
    {
        return $this->hasMany(Domain::class);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'active' || $this->isOnTrial();
    }

    public function isOnTrial(): bool
    {
        return $this->status === 'trial' && $this->trial_ends_at && $this->trial_ends_at->isFuture();
    }
}
