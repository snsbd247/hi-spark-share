<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class EmployeeAccount extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'type', 'amount', 'coa_account_id',
        'reference', 'settlement_id', 'salary_sheet_id', 'journal_ref',
        'date', 'description', 'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'date'   => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function account()
    {
        return $this->belongsTo(Account::class, 'coa_account_id');
    }

    public function settlement()
    {
        return $this->belongsTo(EmployeeSettlement::class);
    }
}
