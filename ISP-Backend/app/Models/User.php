<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class User extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'users';

    protected $fillable = [
        'id', 'tenant_id', 'full_name', 'email', 'username', 'mobile', 'address',
        'avatar_url', 'password_hash', 'staff_id', 'status', 'language',
        'must_change_password',
    ];

    protected $casts = [
        'must_change_password' => 'boolean',
    ];

    protected $hidden = ['password_hash'];

    public function roles()
    {
        return $this->hasMany(UserRole::class, 'user_id');
    }

    public function sessions()
    {
        return $this->hasMany(AdminSession::class, 'admin_id');
    }
}
