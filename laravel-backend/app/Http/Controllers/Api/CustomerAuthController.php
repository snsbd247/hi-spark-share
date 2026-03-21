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
        $expiresAt = now()->addHours(8);

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

    public function verify(Request $request)
    {
        $customer = $request->get('portal_customer');
        return response()->json([
            'valid' => true,
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
        ]);
    }
}
