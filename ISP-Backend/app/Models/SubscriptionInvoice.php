<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SubscriptionInvoice extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'tenant_id', 'plan_id', 'amount', 'tax_amount',
        'total_amount', 'proration_credit', 'billing_cycle',
        'due_date', 'paid_date', 'status', 'payment_method', 'notes',
        'subscription_id', 'transaction_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'proration_credit' => 'decimal:2',
        'due_date' => 'date',
        'paid_date' => 'date',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function plan()
    {
        return $this->belongsTo(SaasPlan::class, 'plan_id');
    }
}
