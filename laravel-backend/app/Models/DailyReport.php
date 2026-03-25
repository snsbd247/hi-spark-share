<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class DailyReport extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'report_date',
        'total_income', 'billing_income', 'sales_income', 'other_income',
        'total_expense', 'purchase_expense', 'operational_expense',
        'net_profit', 'gross_profit',
        'new_customers', 'total_sales_count', 'total_purchases_count', 'bills_paid',
    ];

    protected $casts = [
        'report_date'         => 'date',
        'total_income'        => 'decimal:2',
        'billing_income'      => 'decimal:2',
        'sales_income'        => 'decimal:2',
        'other_income'        => 'decimal:2',
        'total_expense'       => 'decimal:2',
        'purchase_expense'    => 'decimal:2',
        'operational_expense' => 'decimal:2',
        'net_profit'          => 'decimal:2',
        'gross_profit'        => 'decimal:2',
    ];
}
