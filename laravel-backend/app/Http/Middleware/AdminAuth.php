<?php

namespace App\Http\Middleware;

use App\Models\AdminSession;
use Closure;
use Illuminate\Http\Request;

class AdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $session = AdminSession::where('session_token', $token)
            ->where('status', 'active')
            ->first();

        if (!$session) {
            return response()->json(['error' => 'Invalid or expired session'], 401);
        }

        $profile = $session->profile;
        if (!$profile || $profile->status !== 'active') {
            return response()->json(['error' => 'Account disabled'], 403);
        }

        $request->merge(['admin_user' => $profile, 'admin_session' => $session]);

        return $next($request);
    }
}
