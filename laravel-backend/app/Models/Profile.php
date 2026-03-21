<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'full_name', 'email', 'username', 'mobile', 'address',
        'avatar_url', 'password_hash', 'staff_id', 'status',
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
