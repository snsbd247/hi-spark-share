<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = ['id', 'module', 'action', 'description'];
}
