<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FiberCore extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'fiber_cores';

    protected $fillable = [
        'tenant_id', 'fiber_cable_id', 'core_number', 'color', 'status', 'connected_olt_port_id',
    ];

    protected $casts = [
        'core_number' => 'integer',
    ];

    public function connectedPort()
    {
        return $this->belongsTo(FiberPonPort::class, 'connected_olt_port_id');
    }

    public function spliceFrom()
    {
        return $this->hasMany(CoreConnection::class, 'from_core_id');
    }

    public function spliceTo()
    {
        return $this->hasMany(CoreConnection::class, 'to_core_id');
    }

    public function cable()
    {
        return $this->belongsTo(FiberCable::class, 'fiber_cable_id');
    }

    public function splitter()
    {
        return $this->hasOne(FiberSplitter::class, 'core_id');
    }
}
