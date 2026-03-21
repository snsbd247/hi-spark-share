<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAdminUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'full_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255|unique:profiles,email',
            'username' => 'required|string|max:100|unique:profiles,username',
            'password' => 'required|string|min:6|max:255',
            'role' => 'required|string|in:super_admin,admin,staff,manager,operator,technician,accountant',
            'mobile' => 'nullable|string|max:20',
            'staff_id' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:500',
        ];
    }
}
