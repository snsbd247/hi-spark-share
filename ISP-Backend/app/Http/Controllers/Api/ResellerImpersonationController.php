<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reseller;
use App\Models\ResellerSession;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ResellerImpersonationController extends Controller
{
    /**
     * Tenant admin impersonates a reseller (login as reseller without password)
     */
    public function impersonate(Request $request, string $resellerId)
    {
        $admin = $request->get('admin_user');

        $reseller = Reseller::withoutGlobalScopes()
            ->where('id', $resellerId)
            ->where('tenant_id', $admin->tenant_id)
            ->first();

        if (!$reseller) {
            return response()->json(['error' => 'Reseller not found or cross-tenant access denied'], 403);
        }

        if ($reseller->status !== 'active') {
            return response()->json(['error' => 'Reseller account is not active'], 422);
        }

        // Create reseller session
        $sessionToken = Str::uuid()->toString();
        ResellerSession::create([
            'reseller_id' => $reseller->id,
            'session_token' => $sessionToken,
            'ip_address' => $request->ip(),
            'browser' => 'Impersonation',
            'device_name' => "Impersonated by {$admin->full_name}",
            'status' => 'active',
        ]);

        // Log activity
        ActivityLogger::log(
            'impersonate_reseller',
            'reseller',
            "Admin {$admin->full_name} impersonated reseller: {$reseller->name}",
            $admin->id,
            $admin->tenant_id,
            ['reseller_id' => $reseller->id, 'reseller_name' => $reseller->name]
        );

        return response()->json([
            'token' => $sessionToken,
            'user' => [
                'id' => $reseller->id,
                'name' => $reseller->name,
                'email' => $reseller->email ?? '',
                'phone' => $reseller->phone ?? '',
                'company_name' => $reseller->company_name ?? '',
                'tenant_id' => $reseller->tenant_id,
                'wallet_balance' => (float) $reseller->wallet_balance,
                'user_id' => $reseller->user_id ?? '',
            ],
            'impersonated' => true,
            'impersonated_by' => $admin->id,
        ]);
    }
}
