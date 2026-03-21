<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBillRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'customer_id' => 'required|uuid|exists:customers,id',
            'month' => 'required|string|max:20',
            'amount' => 'required|numeric|min:0|max:999999',
            'due_date' => 'nullable|date',
        ];
    }
}
