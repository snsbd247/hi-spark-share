<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasUuid;

    protected $fillable = ['id', 'setting_key', 'setting_value'];
}
