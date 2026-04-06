<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ExpenseHead extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = ['id', 'tenant_id', 'name', 'description', 'status'];
}
