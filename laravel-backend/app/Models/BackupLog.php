<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class BackupLog extends Model
{
    use HasUuid;

    const UPDATED_AT = null;

    protected $fillable = [
        'id', 'file_name', 'file_size', 'backup_type',
        'status', 'created_by', 'error_message',
    ];
}
