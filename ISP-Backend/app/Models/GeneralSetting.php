<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class GeneralSetting extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'site_name', 'logo_url', 'login_logo_url', 'favicon_url',
        'primary_color', 'email', 'mobile', 'address',
        'support_email', 'support_phone',
    ];
}
