<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MikrotikTestRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'ip_address' => 'required|ip',
            'username' => 'required|string|max:100',
            'password' => 'required|string|max:100',
            'api_port' => 'nullable|integer|min:1|max:65535',
        ];
    }
}
