<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FiberSplitter extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'fiber_splitters';

    protected $fillable = [
        'tenant_id', 'core_id', 'ratio', 'location', 'label', 'status',
    ];

    public function core()
    {
        return $this->belongsTo(FiberCore::class, 'core_id');
    }

    public function outputs()
    {
        return $this->hasMany(FiberSplitterOutput::class, 'splitter_id');
    }
}
