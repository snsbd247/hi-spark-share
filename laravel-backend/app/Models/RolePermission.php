<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class RolePermission extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = ['id', 'role_id', 'permission_id'];
}
