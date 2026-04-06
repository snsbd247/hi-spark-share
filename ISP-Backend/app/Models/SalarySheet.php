<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SalarySheet extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'month', 'basic_salary',
        'house_rent', 'medical', 'conveyance', 'other_allowance',
        'bonus', 'deduction', 'loan_deduction',
        'pf_deduction', 'savings_deduction',
        'net_salary', 'payment_method', 'status', 'paid_date',
    ];

    protected $casts = [
        'basic_salary'      => 'decimal:2',
        'house_rent'        => 'decimal:2',
        'medical'           => 'decimal:2',
        'conveyance'        => 'decimal:2',
        'other_allowance'   => 'decimal:2',
        'bonus'             => 'decimal:2',
        'deduction'         => 'decimal:2',
        'loan_deduction'    => 'decimal:2',
        'pf_deduction'      => 'decimal:2',
        'savings_deduction' => 'decimal:2',
        'net_salary'        => 'decimal:2',
        'paid_date'         => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
