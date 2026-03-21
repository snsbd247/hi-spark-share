<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PortalCreateTicketRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'subject' => 'required|string|max:255',
            'category' => 'nullable|string|in:technical,billing,general,complaint',
            'priority' => 'nullable|string|in:low,medium,high,urgent',
            'message' => 'nullable|string|max:5000',
        ];
    }
}
