<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'customer_id' => 'required|uuid|exists:customers,id',
            'amount' => 'required|numeric|min:1|max:999999',
            'payment_method' => 'required|string|in:cash,bkash,nagad,bank,online,other',
            'bill_id' => 'nullable|uuid|exists:bills,id',
            'transaction_id' => 'nullable|string|max:100',
            'month' => 'nullable|string|max:20',
            'status' => 'nullable|string|in:completed,pending,failed',
        ];
    }
}
