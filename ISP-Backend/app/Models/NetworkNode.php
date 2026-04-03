<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class NetworkNode extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'type', 'lat', 'lng',
        'parent_id', 'status', 'device_id', 'metadata',
    ];

    protected $casts = [
        'lat' => 'float',
        'lng' => 'float',
        'metadata' => 'array',
    ];

    public function parent()
    {
        return $this->belongsTo(NetworkNode::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(NetworkNode::class, 'parent_id');
    }

    public function linksFrom()
    {
        return $this->hasMany(NetworkLink::class, 'from_node_id');
    }

    public function linksTo()
    {
        return $this->hasMany(NetworkLink::class, 'to_node_id');
    }
}
