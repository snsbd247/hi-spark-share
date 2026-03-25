<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Designation extends Model
{
    use HasUuid;

    protected $fillable = ['id', 'name', 'description', 'status'];

    public function employees()
    {
        return $this->hasMany(Employee::class);
    }
}
