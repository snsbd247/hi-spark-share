<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reseller;
use App\Models\ResellerSession;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ResellerAuthController extends Controller
{
    /**
     * Reseller login via user_id + password
     */
    public function login(Request $request)
    {
        $request->validate([
            'user_id' => 'required|string',
            'password' => 'required|string|min:6',
        ]);

        $reseller = Reseller::withoutGlobalScopes()
            ->where('user_id', $request->user_id)
            ->where('status', 'active')
            ->first();

        if (!$reseller) {
            return response()->json(['error' => 'Wrong User ID & Password'], 401);
        }

        if (!$reseller->password_hash || !password_verify($request->password, $reseller->password_hash)) {
            return response()->json(['error' => 'Wrong User ID & Password'], 401);
        }

        $sessionToken = Str::uuid()->toString();
        ResellerSession::create([
            'reseller_id' => $reseller->id,
            'session_token' => $sessionToken,
            'ip_address' => $request->ip(),
            'browser' => substr($request->userAgent() ?? 'Unknown', 0, 100),
            'device_name' => 'Web Browser',
            'status' => 'active',
        ]);

        ActivityLogger::log(
            'login',
            'reseller',
            "Reseller {$reseller->name} logged in",
            null,
            $reseller->tenant_id,
            ['reseller_id' => $reseller->id]
        );

        return response()->json([
            'token' => $sessionToken,
            'user' => [
                'id' => $reseller->id,
                'name' => $reseller->name,
                'email' => $reseller->email,
                'phone' => $reseller->phone,
                'company_name' => $reseller->company_name,
                'tenant_id' => $reseller->tenant_id,
                'wallet_balance' => (float) $reseller->wallet_balance,
                'user_id' => $reseller->user_id,
            ],
        ]);
    }

    /**
     * Reseller logout
     */
    public function logout(Request $request)
    {
        $session = $request->get('reseller_session');
        if ($session) {
            $session->update(['status' => 'expired']);
        }
        return response()->json(['message' => 'Logged out']);
    }

    /**
     * Get current reseller profile
     */
    public function me(Request $request)
    {
        $reseller = $request->get('reseller_user');
        return response()->json([
            'user' => [
                'id' => $reseller->id,
                'name' => $reseller->name,
                'email' => $reseller->email,
                'phone' => $reseller->phone,
                'company_name' => $reseller->company_name,
                'tenant_id' => $reseller->tenant_id,
                'wallet_balance' => (float) $reseller->wallet_balance,
                'user_id' => $reseller->user_id,
            ],
        ]);
    }
}
