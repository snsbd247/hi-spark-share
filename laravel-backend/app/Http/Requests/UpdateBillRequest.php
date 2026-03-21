<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBillRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'amount' => 'sometimes|numeric|min:0|max:999999',
            'status' => 'sometimes|string|in:unpaid,paid,partial,overdue',
            'due_date' => 'nullable|date',
            'month' => 'sometimes|string|max:20',
        ];
    }
}
