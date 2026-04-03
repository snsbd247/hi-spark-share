<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class NetworkLink extends Model
{
    use HasUuid, BelongsToTenant;

    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'from_node_id', 'to_node_id', 'link_type', 'label',
    ];

    public function fromNode()
    {
        return $this->belongsTo(NetworkNode::class, 'from_node_id');
    }

    public function toNode()
    {
        return $this->belongsTo(NetworkNode::class, 'to_node_id');
    }
}
