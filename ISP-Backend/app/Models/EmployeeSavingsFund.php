<?php

namespace App\Models;

use App\Traits\HasUuid;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class EmployeeSavingsFund extends Model
{
    use HasUuid, BelongsToTenant;

    public $timestamps = false;

    protected $table = 'employee_savings_fund';

    protected $fillable = [
        'id', 'tenant_id', 'employee_id', 'type', 'amount',
        'date', 'description',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'date'   => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
