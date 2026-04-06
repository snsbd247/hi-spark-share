<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Zone extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = ['id', 'tenant_id', 'area_name', 'address', 'status'];
}
