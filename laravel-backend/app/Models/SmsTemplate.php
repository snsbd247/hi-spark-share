<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SmsTemplate extends Model
{
    use HasUuid;

    protected $fillable = ['id', 'name', 'message'];
}
