<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AdminLoginRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email' => 'required|string|max:255',
            'password' => 'required|string|min:4|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'Username or email is required.',
            'password.required' => 'Password is required.',
            'password.min' => 'Password must be at least 4 characters.',
        ];
    }
}
