<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = ['id', 'tenant_id', 'setting_key', 'setting_value'];
}
