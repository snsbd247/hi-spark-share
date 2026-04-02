<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendSmsRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'phone' => 'required_without:to|string|max:20',
            'to' => 'required_without:phone|string|max:20',
            'message' => 'required|string|max:1000',
            'customer_id' => 'nullable|uuid|exists:customers,id',
            'sms_type' => 'nullable|string|max:50',
        ];
    }
}
