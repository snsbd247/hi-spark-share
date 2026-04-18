<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CustomerAuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'pppoe_username' => 'required|string',
            'pppoe_password' => 'required|string',
        ]);

        $customer = Customer::where('pppoe_username', $request->pppoe_username)->first();

        if (!$customer || !$customer->pppoe_password_hash) {
            return response()->json(['error' => 'Invalid PPPoE username or password'], 401);
        }

        if (!Hash::check($request->pppoe_password, $customer->pppoe_password_hash)) {
            return response()->json(['error' => 'Invalid PPPoE username or password'], 401);
        }

        if ($customer->status === 'disconnected') {
            return response()->json(['error' => 'Account disconnected. Contact support.'], 403);
        }

        // Invalidate old sessions
        CustomerSession::where('customer_id', $customer->id)->delete();

        $sessionToken = Str::uuid()->toString();
        $expiresAt = now()->addHours(24);

        CustomerSession::create([
            'customer_id' => $customer->id,
            'session_token' => $sessionToken,
            'expires_at' => $expiresAt,
        ]);

        $customer->load('package');

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'customer_id' => $customer->customer_id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'area' => $customer->area,
                'status' => $customer->status,
                'monthly_bill' => $customer->monthly_bill,
                'package_id' => $customer->package_id,
                'photo_url' => $customer->photo_url,
                'connection_status' => $customer->connection_status,
                'pppoe_username' => $customer->pppoe_username,
                'package' => $customer->package ? [
                    'name' => $customer->package->name,
                    'speed' => $customer->package->speed,
                ] : null,
            ],
            'session_token' => $sessionToken,
            'expires_at' => $expiresAt->toISOString(),
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->header('X-Session-Token');
        if ($token) {
            CustomerSession::where('session_token', $token)->delete();
        }
        return response()->json(['success' => true]);
    }

    /**
     * Tenant admin impersonates a customer — issues a one-time portal session token.
     * Returns session_token; admin opens portal in new tab, own session stays intact.
     */
    public function impersonate(Request $request, string $customerId)
    {
        $admin = $request->get('admin') ?? $request->user();
        if (!$admin) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $customer = Customer::find($customerId);
        if (!$customer) {
            return response()->json(['error' => 'Customer not found'], 404);
        }

        $adminTenantId = is_array($admin) ? ($admin['tenant_id'] ?? null) : ($admin->tenant_id ?? null);
        $adminRole = is_array($admin) ? ($admin['role'] ?? '') : ($admin->role ?? '');
        if ($adminTenantId && $customer->tenant_id && $adminTenantId !== $customer->tenant_id && $adminRole !== 'super_admin') {
            return response()->json(['error' => 'Forbidden: customer belongs to another tenant'], 403);
        }

        $sessionToken = Str::uuid()->toString();
        $expiresAt = now()->addHours(2);

        CustomerSession::create([
            'customer_id' => $customer->id,
            'session_token' => $sessionToken,
            'expires_at' => $expiresAt,
        ]);

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'customer_id' => $customer->customer_id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'area' => $customer->area,
                'status' => $customer->status,
                'monthly_bill' => $customer->monthly_bill,
                'package_id' => $customer->package_id,
                'photo_url' => $customer->photo_url,
            ],
            'session_token' => $sessionToken,
            'expires_at' => $expiresAt->toISOString(),
            'impersonated' => true,
        ]);
    }

    public function verify(Request $request)
    {
        // Support both middleware-injected customer and direct session_token in body
        $customer = $request->get('portal_customer');

        if (!$customer) {
            $sessionToken = $request->input('session_token');
            if (!$sessionToken) {
                return response()->json(['valid' => false, 'error' => 'No session token'], 401);
            }

            $session = CustomerSession::where('session_token', $sessionToken)
                ->where('expires_at', '>', now())
                ->first();

            if (!$session) {
                return response()->json(['valid' => false, 'error' => 'Invalid or expired session'], 401);
            }

            $customer = Customer::find($session->customer_id);
            if (!$customer) {
                return response()->json(['valid' => false, 'error' => 'Customer not found'], 404);
            }
        }

        $customer->load('package');

        $response = [
            'valid' => true,
            'customer' => [
                'id' => $customer->id,
                'customer_id' => $customer->customer_id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'area' => $customer->area,
                'road' => $customer->road,
                'house' => $customer->house,
                'city' => $customer->city,
                'email' => $customer->email,
                'status' => $customer->status,
                'monthly_bill' => $customer->monthly_bill,
                'package_id' => $customer->package_id,
                'photo_url' => $customer->photo_url,
                'connection_status' => $customer->connection_status,
                'pppoe_username' => $customer->pppoe_username,
                'ip_address' => $customer->ip_address,
                'onu_mac' => $customer->onu_mac,
                'router_mac' => $customer->router_mac,
                'installation_date' => $customer->installation_date,
                'username' => $customer->username,
                'father_name' => $customer->father_name,
                'mother_name' => $customer->mother_name,
                'occupation' => $customer->occupation,
                'nid' => $customer->nid,
                'alt_phone' => $customer->alt_phone,
                'permanent_address' => $customer->permanent_address,
                'gateway' => $customer->gateway,
                'subnet' => $customer->subnet,
                'discount' => $customer->discount,
                'connectivity_fee' => $customer->connectivity_fee,
                'due_date_day' => $customer->due_date_day,
                'package' => $customer->package ? [
                    'name' => $customer->package->name,
                    'speed' => $customer->package->speed,
                ] : null,
            ],
        ];

        // Include bills if requested
        if ($request->boolean('include_bills')) {
            $response['bills'] = $customer->bills()->orderBy('month', 'desc')->get();
        }

        // Include payments if requested
        if ($request->boolean('include_payments')) {
            $response['payments'] = $customer->payments()->orderBy('created_at', 'desc')->get();
        }

        // Include ledger if requested
        if ($request->boolean('include_ledger')) {
            $response['ledger'] = $customer->ledgerEntries()->orderBy('date', 'desc')->get();
        }

        return response()->json($response);
    }
}
