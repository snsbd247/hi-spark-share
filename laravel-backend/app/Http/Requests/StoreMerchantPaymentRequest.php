<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMerchantPaymentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'transaction_id' => 'required|string|max:100|unique:merchant_payments,transaction_id',
            'sender_phone' => 'required|string|max:20',
            'amount' => 'required|numeric|min:1|max:999999',
            'reference' => 'nullable|string|max:255',
            'payment_date' => 'nullable|date',
            'sms_text' => 'nullable|string|max:1000',
            'notes' => 'nullable|string|max:500',
        ];
    }
}
