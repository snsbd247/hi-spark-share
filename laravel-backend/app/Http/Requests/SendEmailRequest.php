<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendEmailRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'to' => 'required|email|max:255',
            'subject' => 'required|string|max:255',
            'body' => 'required|string|max:50000',
            'cc' => 'nullable|email|max:255',
        ];
    }
}
