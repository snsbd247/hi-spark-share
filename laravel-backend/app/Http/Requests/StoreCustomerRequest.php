<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'customer_id' => 'required|string|max:50|unique:customers,customer_id',
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'area' => 'required|string|max:255',
            'monthly_bill' => 'required|numeric|min:0|max:999999',
            'email' => 'nullable|email|max:255',
            'alt_phone' => 'nullable|string|max:20',
            'father_name' => 'nullable|string|max:255',
            'mother_name' => 'nullable|string|max:255',
            'nid' => 'nullable|string|max:50',
            'occupation' => 'nullable|string|max:100',
            'package_id' => 'nullable|uuid|exists:packages,id',
            'router_id' => 'nullable|uuid|exists:mikrotik_routers,id',
            'pppoe_username' => 'nullable|string|max:100',
            'pppoe_password' => 'nullable|string|max:100',
            'ip_address' => 'nullable|ip',
            'status' => 'nullable|string|in:active,inactive,suspended',
            'connection_status' => 'nullable|string|in:active,suspended,disconnected',
            'discount' => 'nullable|numeric|min:0|max:100',
            'due_date_day' => 'nullable|integer|min:1|max:31',
            'installation_date' => 'nullable|date',
            'connectivity_fee' => 'nullable|numeric|min:0',
            'house' => 'nullable|string|max:255',
            'road' => 'nullable|string|max:255',
            'village' => 'nullable|string|max:255',
            'post_office' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'district' => 'nullable|string|max:255',
            'permanent_address' => 'nullable|string|max:500',
            'box_name' => 'nullable|string|max:100',
            'cable_length' => 'nullable|string|max:50',
            'onu_mac' => 'nullable|string|max:50',
            'router_mac' => 'nullable|string|max:50',
            'subnet' => 'nullable|string|max:50',
            'gateway' => 'nullable|string|max:50',
            'pop_location' => 'nullable|string|max:255',
            'installed_by' => 'nullable|string|max:255',
        ];
    }
}
