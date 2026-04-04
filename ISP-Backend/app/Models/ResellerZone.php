<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ResellerZone extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'reseller_zones';

    protected $fillable = [
        'id', 'tenant_id', 'reseller_id', 'name', 'status',
    ];

    public function reseller()
    {
        return $this->belongsTo(Reseller::class);
    }

    public function customers()
    {
        return $this->hasMany(Customer::class, 'zone_id');
    }
}
