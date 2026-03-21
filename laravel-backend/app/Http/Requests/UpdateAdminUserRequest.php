<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAdminUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $userId = $this->route('id');
        return [
            'full_name' => 'sometimes|string|max:255',
            'email' => "nullable|email|max:255|unique:profiles,email,{$userId}",
            'username' => "sometimes|string|max:100|unique:profiles,username,{$userId}",
            'password' => 'nullable|string|min:6|max:255',
            'role' => 'sometimes|string|in:super_admin,admin,staff,manager,operator,technician,accountant',
            'mobile' => 'nullable|string|max:20',
            'staff_id' => 'nullable|string|max:50',
            'status' => 'sometimes|string|in:active,disabled',
            'address' => 'nullable|string|max:500',
        ];
    }
}
