<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Package extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'name', 'speed', 'monthly_price', 'download_speed', 'upload_speed',
        'is_active', 'mikrotik_profile_name', 'bandwidth_profile', 'burst_limit',
        'router_id', 'ip_pool_id',
    ];

    protected $casts = [
        'monthly_price' => 'decimal:2',
        'download_speed' => 'integer',
        'upload_speed' => 'integer',
        'is_active' => 'boolean',
    ];

    public function router()
    {
        return $this->belongsTo(MikrotikRouter::class, 'router_id');
    }

    public function ipPool()
    {
        return $this->belongsTo(IpPool::class, 'ip_pool_id');
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }
}
