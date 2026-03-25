<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class OtherHead extends Model
{
    use HasUuid;

    protected $fillable = ['id', 'name', 'type', 'description', 'status'];
}
