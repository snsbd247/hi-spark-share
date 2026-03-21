<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreatePaymentGatewayRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'bill_id' => 'required|uuid|exists:bills,id',
            'customer_id' => 'required|uuid|exists:customers,id',
            'amount' => 'required|numeric|min:1|max:999999',
            'callback_url' => 'nullable|url|max:500',
        ];
    }
}
