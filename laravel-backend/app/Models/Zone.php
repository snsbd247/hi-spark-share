<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Zone extends Model
{
    use HasUuid;

    protected $fillable = ['id', 'area_name', 'address', 'status'];
}
