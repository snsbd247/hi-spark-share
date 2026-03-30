<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class UserRole extends Model
{
    use HasUuid;

    // Enable timestamps — migration patch adds these columns
    public $timestamps = true;

    protected $fillable = ['id', 'user_id', 'role', 'custom_role_id'];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function customRole()
    {
        return $this->belongsTo(CustomRole::class);
    }
}
