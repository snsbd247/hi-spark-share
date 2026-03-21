<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class UserRole extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = ['id', 'user_id', 'role', 'custom_role_id'];

    public function profile()
    {
        return $this->belongsTo(Profile::class, 'user_id');
    }

    public function customRole()
    {
        return $this->belongsTo(CustomRole::class);
    }
}
