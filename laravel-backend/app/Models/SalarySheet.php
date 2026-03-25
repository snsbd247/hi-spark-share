<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SalarySheet extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'employee_id', 'month', 'basic_salary', 'bonus',
        'deduction', 'loan_deduction', 'net_salary',
        'payment_method', 'status', 'paid_date',
    ];

    protected $casts = [
        'basic_salary'   => 'decimal:2',
        'bonus'          => 'decimal:2',
        'deduction'      => 'decimal:2',
        'loan_deduction' => 'decimal:2',
        'net_salary'     => 'decimal:2',
        'paid_date'      => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
