<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'name', 'description', 'status',
    ];

    public function products()
    {
        return $this->hasMany(Product::class, 'category_id');
    }
}
