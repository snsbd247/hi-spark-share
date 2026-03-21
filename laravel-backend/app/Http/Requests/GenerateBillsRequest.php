<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GenerateBillsRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'month' => 'required|string|regex:/^\d{4}-\d{2}$/',
        ];
    }

    public function messages(): array
    {
        return [
            'month.regex' => 'Month must be in YYYY-MM format.',
        ];
    }
}
