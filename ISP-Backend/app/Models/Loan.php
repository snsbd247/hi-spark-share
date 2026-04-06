<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Loan extends Model
{
    use HasUuid, BelongsToTenant;

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'amount', 'paid_amount',
        'monthly_deduction', 'approved_date', 'reason', 'status',
    ];

    protected $casts = [
        'amount'            => 'decimal:2',
        'paid_amount'       => 'decimal:2',
        'monthly_deduction' => 'decimal:2',
        'approved_date'     => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
