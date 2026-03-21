<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendBulkSmsRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'recipients' => 'required|array|min:1|max:1000',
            'recipients.*.phone' => 'required|string|max:20',
            'recipients.*.message' => 'required|string|max:1000',
            'recipients.*.customer_id' => 'nullable|uuid',
        ];
    }
}
