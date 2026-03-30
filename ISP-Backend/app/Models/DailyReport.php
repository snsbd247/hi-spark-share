<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class DailyReport extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'date', 'total_billed', 'total_collection',
        'total_expense', 'new_customers', 'notes',
    ];

    protected $casts = [
        'date'             => 'date',
        'total_billed'     => 'decimal:2',
        'total_collection' => 'decimal:2',
        'total_expense'    => 'decimal:2',
    ];
}
