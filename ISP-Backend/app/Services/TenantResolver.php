<?php

namespace App\Services;

use App\Models\Domain;
use App\Models\Tenant;
use Illuminate\Support\Facades\Cache;

class TenantResolver
{
    /**
     * The main SaaS domain(s) — requests to these are NOT tenanted.
     */
    protected array $centralDomains;

    public function __construct()
    {
        $this->centralDomains = array_filter(array_map('trim', explode(',', env('CENTRAL_DOMAINS', 'smartispapp.com,www.smartispapp.com,localhost'))));
    }

    /**
     * Resolve tenant from the HTTP host.
     */
    public function resolve(string $host): ?Tenant
    {
        // Normalize
        $host = strtolower(trim($host));

        // Skip central/root domains
        if ($this->isCentralDomain($host)) {
            return null;
        }

        // Cache tenant lookups for 5 minutes
        return Cache::remember("tenant:host:{$host}", 300, function () use ($host) {
            // 1) Check custom domains table
            $domain = Domain::where('domain', $host)->first();
            if ($domain) {
                return $domain->tenant;
            }

            // 2) Try subdomain resolution
            $subdomain = $this->extractSubdomain($host);
            if ($subdomain) {
                return Tenant::where('subdomain', $subdomain)->first();
            }

            return null;
        });
    }

    /**
     * Check if the host is a central (non-tenant) domain.
     */
    public function isCentralDomain(string $host): bool
    {
        $host = strtolower(trim($host));

        // Exact match
        if (in_array($host, $this->centralDomains)) {
            return true;
        }

        // localhost with port
        if (str_starts_with($host, 'localhost') || str_starts_with($host, '127.0.0.1')) {
            return true;
        }

        // Lovable preview domains
        if (str_contains($host, 'lovable.app')) {
            return true;
        }

        return false;
    }

    /**
     * Extract subdomain from host.
     * e.g. isp1.smartispapp.com → isp1
     */
    protected function extractSubdomain(string $host): ?string
    {
        // Remove port if present
        $host = preg_replace('/:\d+$/', '', $host);

        foreach ($this->centralDomains as $central) {
            $central = preg_replace('/:\d+$/', '', $central);

            // Skip www and bare domain
            if ($host === $central || $host === "www.{$central}") {
                return null;
            }

            // Check if host ends with .centralDomain
            $suffix = ".{$central}";
            if (str_ends_with($host, $suffix)) {
                $sub = substr($host, 0, -strlen($suffix));
                // Ignore www prefix
                if ($sub && $sub !== 'www') {
                    return $sub;
                }
            }
        }

        return null;
    }

    /**
     * Flush tenant cache for a specific host.
     */
    public static function flushCache(string $host): void
    {
        Cache::forget("tenant:host:{$host}");
    }

    /**
     * Flush all tenant caches for a tenant.
     */
    public static function flushTenantCache(Tenant $tenant): void
    {
        // Flush subdomain cache
        if ($tenant->subdomain) {
            $centralDomains = array_filter(array_map('trim', explode(',', env('CENTRAL_DOMAINS', 'smartispapp.com'))));
            foreach ($centralDomains as $central) {
                Cache::forget("tenant:host:{$tenant->subdomain}.{$central}");
            }
        }

        // Flush custom domain caches
        foreach ($tenant->domains as $domain) {
            Cache::forget("tenant:host:{$domain->domain}");
        }
    }
}
