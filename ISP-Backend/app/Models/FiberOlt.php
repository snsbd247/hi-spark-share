<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FiberOlt extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'fiber_olts';

    protected $fillable = [
        'tenant_id', 'name', 'location', 'total_pon_ports', 'status', 'lat', 'lng',
    ];

    protected $casts = [
        'total_pon_ports' => 'integer',
        'lat' => 'float',
        'lng' => 'float',
    ];

    protected $casts = [
        'total_pon_ports' => 'integer',
    ];

    public function ponPorts()
    {
        return $this->hasMany(FiberPonPort::class, 'olt_id');
    }
}
