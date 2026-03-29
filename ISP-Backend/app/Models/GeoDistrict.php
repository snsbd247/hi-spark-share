<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class GeoDistrict extends Model
{
    use HasUuid;

    protected $table = 'geo_districts';

    protected $fillable = ['id', 'name', 'bn_name', 'division_id', 'status'];

    public function division()
    {
        return $this->belongsTo(GeoDivision::class, 'division_id');
    }

    public function upazilas()
    {
        return $this->hasMany(GeoUpazila::class, 'district_id');
    }
}
