<?php

namespace App\Http\Middleware;

use App\Models\AdminSession;
use Closure;
use Illuminate\Http\Request;

class AdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken() ?: $request->header('X-Session-Token');

        if (!$token) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $session = AdminSession::where('session_token', $token)
            ->where('status', 'active')
            ->first();

        if ($session) {
            $user = $session->user;

            if (!$user || $user->status !== 'active') {
                return response()->json(['error' => 'Account disabled'], 403);
            }

            $session->touch();
            $request->attributes->set('admin_user', $user);
            $request->attributes->set('admin_session', $session);

            return $next($request);
        }

        $superSession = \App\Models\SuperAdminSession::where('session_token', $token)
            ->where('status', 'active')
            ->first();

        if ($superSession) {
            $admin = $superSession->superAdmin;

            if (!$admin || $admin->status !== 'active') {
                return response()->json(['error' => 'Account disabled'], 403);
            }

            $superSession->touch();

            $request->attributes->set('admin_user', (object) [
                'id' => $admin->id,
                'full_name' => $admin->name,
                'email' => $admin->email,
                'username' => $admin->username,
                'status' => $admin->status,
                'tenant_id' => null,
                'is_super_admin' => true,
            ]);
            $request->attributes->set('admin_session', $superSession);

            return $next($request);
        }

        return response()->json(['error' => 'Invalid or expired session'], 401);
    }
}
