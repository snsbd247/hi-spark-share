<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CoreConnection extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'core_connections';
    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'from_core_id', 'to_core_id', 'label',
    ];

    public function fromCore()
    {
        return $this->belongsTo(FiberCore::class, 'from_core_id');
    }

    public function toCore()
    {
        return $this->belongsTo(FiberCore::class, 'to_core_id');
    }
}
