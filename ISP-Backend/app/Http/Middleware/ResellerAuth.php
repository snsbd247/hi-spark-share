<?php

namespace App\Http\Middleware;

use App\Models\ResellerSession;
use Closure;
use Illuminate\Http\Request;

class ResellerAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken() ?: $request->header('X-Session-Token');

        if (!$token) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $session = ResellerSession::where('session_token', $token)
            ->where('status', 'active')
            ->first();

        if (!$session) {
            return response()->json(['error' => 'Invalid or expired session'], 401);
        }

        $reseller = $session->reseller;
        if (!$reseller || $reseller->status !== 'active') {
            return response()->json(['error' => 'Account disabled or suspended'], 403);
        }

        // Touch session
        $session->touch();

        $request->attributes->set('reseller_user', $reseller);
        $request->attributes->set('reseller_session', $session);

        return $next($request);
    }
}
