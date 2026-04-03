<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FiberPonPort extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'fiber_pon_ports';

    protected $fillable = [
        'tenant_id', 'olt_id', 'port_number', 'status',
    ];

    protected $casts = [
        'port_number' => 'integer',
    ];

    public function olt()
    {
        return $this->belongsTo(FiberOlt::class, 'olt_id');
    }

    public function cables()
    {
        return $this->hasMany(FiberCable::class, 'pon_port_id');
    }
}
