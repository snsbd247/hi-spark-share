<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FiberOnu extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'fiber_onus';

    protected $fillable = [
        'tenant_id', 'splitter_output_id', 'serial_number', 'mac_address',
        'status', 'customer_id', 'signal_strength',
    ];

    public function splitterOutput()
    {
        return $this->belongsTo(FiberSplitterOutput::class, 'splitter_output_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
