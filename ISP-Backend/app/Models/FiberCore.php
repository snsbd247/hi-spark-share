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
        'tenant_id', 'fiber_cable_id', 'core_number', 'color', 'status',
    ];

    protected $casts = [
        'core_number' => 'integer',
    ];

    public function cable()
    {
        return $this->belongsTo(FiberCable::class, 'fiber_cable_id');
    }

    public function splitter()
    {
        return $this->hasOne(FiberSplitter::class, 'core_id');
    }
}
