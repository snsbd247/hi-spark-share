<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class MerchantPayment extends Model
{
    use HasUuid;

    protected $fillable = [
        'id', 'transaction_id', 'sender_phone', 'amount', 'reference',
        'payment_date', 'status', 'matched_customer_id', 'matched_bill_id',
        'notes', 'sms_text',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'matched_customer_id');
    }

    public function bill()
    {
        return $this->belongsTo(Bill::class, 'matched_bill_id');
    }
}
