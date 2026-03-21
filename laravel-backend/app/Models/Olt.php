<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Olt extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'ip_address', 'brand', 'location', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];

    public function onus()
    {
        return $this->hasMany(Onu::class, 'olt_id');
    }
}
