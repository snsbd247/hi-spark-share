<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'customer_id', 'name', 'phone', 'alt_phone', 'email',
        'father_name', 'mother_name', 'occupation', 'nid',
        'area', 'division', 'district', 'upazila',
        'road', 'house', 'village', 'post_office', 'city',
        'permanent_address',
        'perm_division', 'perm_district', 'perm_upazila',
        'perm_village', 'perm_road', 'perm_house', 'perm_post_office',
        'pop_location', 'box_name',
        'package_id', 'monthly_bill', 'discount', 'connectivity_fee', 'due_date_day',
        'ip_address', 'gateway', 'subnet', 'pppoe_username', 'pppoe_password',
        'pppoe_password_hash', 'onu_mac', 'router_mac', 'cable_length',
        'router_id', 'installation_date', 'installed_by',
        'status', 'connection_status', 'mikrotik_sync_status',
        'username', 'photo_url',
    ];

    protected $hidden = ['pppoe_password', 'pppoe_password_hash'];

    protected $casts = [
        'monthly_bill' => 'decimal:2',
        'discount' => 'decimal:2',
        'connectivity_fee' => 'decimal:2',
        'due_date_day' => 'integer',
    ];

    public function package()
    {
        return $this->belongsTo(Package::class);
    }

    public function router()
    {
        return $this->belongsTo(MikrotikRouter::class, 'router_id');
    }

    public function bills()
    {
        return $this->hasMany(Bill::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function ledgerEntries()
    {
        return $this->hasMany(CustomerLedger::class);
    }

    public function tickets()
    {
        return $this->hasMany(SupportTicket::class);
    }

    public function sessions()
    {
        return $this->hasMany(CustomerSession::class);
    }

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
