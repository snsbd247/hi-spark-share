<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'employee_id', 'name', 'phone', 'email', 'nid',
        'designation_id', 'joining_date', 'salary', 'address',
        'photo_url', 'status',
    ];

    protected $casts = [
        'salary'       => 'decimal:2',
        'joining_date' => 'date',
    ];

    public function designation()
    {
        return $this->belongsTo(Designation::class);
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    public function loans()
    {
        return $this->hasMany(Loan::class);
    }

    public function salarySheets()
    {
        return $this->hasMany(SalarySheet::class);
    }
}
