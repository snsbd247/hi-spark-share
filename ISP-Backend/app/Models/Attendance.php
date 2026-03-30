<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    use HasUuid;

    protected $table = 'attendance';

    protected $fillable = [
        'id', 'employee_id', 'date', 'status',
        'check_in', 'check_out', 'notes',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
