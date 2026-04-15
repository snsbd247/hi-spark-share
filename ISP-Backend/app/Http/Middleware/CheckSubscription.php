<?php

namespace App\Http\Middleware;

use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use Closure;
use Illuminate\Http\Request;

class CheckSubscription
{
    public function handle(Request $request, Closure $next)
    {
        $tenant = tenant();

        // No tenant context (central domain) → pass through
        if (!$tenant) {
            return $next($request);
        }

        $allowWhileLocked = $request->is('api/admin/me')
            || $request->is('api/admin/logout')
            || $request->is('api/admin/force-password-change');

        $subscription = Subscription::where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->where('end_date', '>=', now()->toDateString())
            ->first();

        $hasPendingInvoice = SubscriptionInvoice::where('tenant_id', $tenant->id)
            ->where('status', 'pending')
            ->exists();

        if ($subscription && !$hasPendingInvoice && $tenant->status !== 'suspended') {
            return $next($request);
        }

        $latestSubscription = Subscription::where('tenant_id', $tenant->id)
            ->orderBy('end_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->first();

        if ($latestSubscription && $latestSubscription->status !== 'expired') {
            $latestSubscription->update(['status' => 'expired']);
        }

        if ($tenant->status !== 'suspended') {
            $tenant->update(['status' => 'suspended']);
        }

        if ($allowWhileLocked) {
            return $next($request);
        }

        return response()->json([
            'error' => $hasPendingInvoice ? 'No active subscription' : 'Subscription expired',
            'message' => $hasPendingInvoice
                ? 'Your subscription is inactive until the pending invoice is paid.'
                : 'Your subscription has expired. Please renew to continue.',
            'expired_at' => $latestSubscription?->end_date?->toDateString(),
        ], 402);

    }
}
