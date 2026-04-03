<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FiberCable extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'fiber_cables';

    protected $fillable = [
        'tenant_id', 'pon_port_id', 'name', 'total_cores', 'color', 'length_meters', 'status',
    ];

    protected $casts = [
        'total_cores' => 'integer',
        'length_meters' => 'float',
    ];

    public function ponPort()
    {
        return $this->belongsTo(FiberPonPort::class, 'pon_port_id');
    }

    public function cores()
    {
        return $this->hasMany(FiberCore::class, 'fiber_cable_id');
    }
}
