<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Loan extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'employee_id', 'amount', 'paid_amount',
        'monthly_deduction', 'loan_date', 'status', 'note',
    ];

    protected $casts = [
        'amount'            => 'decimal:2',
        'paid_amount'       => 'decimal:2',
        'monthly_deduction' => 'decimal:2',
        'loan_date'         => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
