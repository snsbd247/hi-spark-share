<?php

namespace App\Http\Middleware;

use App\Models\AdminSession;
use Closure;
use Illuminate\Http\Request;

class AdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        // Support both Bearer token and X-Session-Token header
        $token = $request->bearerToken() ?: $request->header('X-Session-Token');

        if (!$token) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $session = AdminSession::where('session_token', $token)
            ->where('status', 'active')
            ->first();

        if (!$session) {
            return response()->json(['error' => 'Invalid or expired session'], 401);
        }

        $user = $session->user;
        if (!$user || $user->status !== 'active') {
            return response()->json(['error' => 'Account disabled'], 403);
        }

        // Touch session updated_at to extend activity
        $session->touch();

        $request->merge(['admin_user' => $user, 'admin_session' => $session]);

        return $next($request);
    }
}
