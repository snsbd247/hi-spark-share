<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class GeoUpazila extends Model
{
    use HasUuid;

    protected $table = 'geo_upazilas';

    protected $fillable = ['id', 'name', 'bn_name', 'district_id', 'status'];

    public function district()
    {
        return $this->belongsTo(GeoDistrict::class, 'district_id');
    }
}
