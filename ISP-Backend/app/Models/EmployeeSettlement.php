<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class EmployeeSettlement extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'salary_sheet_id', 'month',
        'total_earn', 'total_deduction', 'net_payable', 'status',
        'payment_method', 'paid_from_account_id', 'journal_ref',
        'settled_at', 'created_by',
    ];

    protected $casts = [
        'total_earn'      => 'decimal:2',
        'total_deduction' => 'decimal:2',
        'net_payable'     => 'decimal:2',
        'settled_at'      => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function entries()
    {
        return $this->hasMany(EmployeeAccount::class, 'settlement_id');
    }
}
