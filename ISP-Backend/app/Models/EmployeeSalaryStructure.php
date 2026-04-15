<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class EmployeeSalaryStructure extends Model
{
    use HasUuid, BelongsToTenant;

    protected $table = 'employee_salary_structure';

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'basic_salary', 'house_rent',
        'medical', 'conveyance', 'other_allowance', 'effective_from',
    ];

    protected $casts = [
        'basic_salary'    => 'decimal:2',
        'house_rent'      => 'decimal:2',
        'medical'         => 'decimal:2',
        'conveyance'      => 'decimal:2',
        'other_allowance' => 'decimal:2',
        'effective_from'  => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
