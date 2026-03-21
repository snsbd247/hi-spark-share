<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class CustomRole extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'description', 'db_role', 'is_system',
    ];

    protected $casts = ['is_system' => 'boolean'];

    public function permissions()
    {
        return $this->belongsToMany(Permission::class, 'role_permissions', 'role_id', 'permission_id');
    }
}
