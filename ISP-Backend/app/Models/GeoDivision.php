<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class GeoDivision extends Model
{
    use HasUuid;

    protected $table = 'geo_divisions';

    protected $fillable = ['id', 'name', 'bn_name', 'status'];

    public function districts()
    {
        return $this->hasMany(GeoDistrict::class, 'division_id');
    }
}
