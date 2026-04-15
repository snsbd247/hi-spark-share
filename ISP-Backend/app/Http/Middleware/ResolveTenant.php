<?php

namespace App\Http\Middleware;

use App\Services\TenantResolver;
use Closure;
use Illuminate\Http\Request;

class ResolveTenant
{
    protected TenantResolver $resolver;

    public function __construct(TenantResolver $resolver)
    {
        $this->resolver = $resolver;
    }

    public function handle(Request $request, Closure $next)
    {
        $host = $request->getHost();

        // Central domain → no tenant context (SaaS landing, super-admin)
        if ($this->resolver->isCentralDomain($host)) {
            return $next($request);
        }

        $tenant = $this->resolver->resolve($host);

        if (!$tenant) {
            return response()->json([
                'error' => 'Tenant not found',
                'message' => 'No ISP account is associated with this domain.',
            ], 404);
        }

        // Bind tenant to the container
        app()->instance('tenant', $tenant);
        app()->instance(\App\Models\Tenant::class, $tenant);

        // Set tenant_id on request for convenience
        $request->merge(['__tenant_id' => $tenant->id]);

        return $next($request);
    }
}
