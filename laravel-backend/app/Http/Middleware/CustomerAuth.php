<?php

namespace App\Http\Middleware;

use App\Models\CustomerSession;
use Closure;
use Illuminate\Http\Request;

class CustomerAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->header('X-Session-Token');

        if (!$token) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $session = CustomerSession::where('session_token', $token)
            ->where('expires_at', '>', now())
            ->first();

        if (!$session) {
            return response()->json(['error' => 'Session expired'], 401);
        }

        $request->merge(['portal_customer' => $session->customer]);

        return $next($request);
    }
}
