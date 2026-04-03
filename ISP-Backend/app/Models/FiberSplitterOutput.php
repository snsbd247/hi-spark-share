<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FiberSplitterOutput extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'fiber_splitter_outputs';

    protected $fillable = [
        'tenant_id', 'splitter_id', 'output_number', 'status',
    ];

    protected $casts = [
        'output_number' => 'integer',
    ];

    public function splitter()
    {
        return $this->belongsTo(FiberSplitter::class, 'splitter_id');
    }

    public function onu()
    {
        return $this->hasOne(FiberOnu::class, 'splitter_output_id');
    }
}
