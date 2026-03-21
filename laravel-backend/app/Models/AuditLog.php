<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasUuid;

    const UPDATED_AT = null;

    protected $fillable = [
        'id', 'admin_id', 'admin_name', 'table_name', 'record_id',
        'action', 'old_data', 'new_data',
    ];

    protected $casts = [
        'old_data' => 'json',
        'new_data' => 'json',
    ];
}
