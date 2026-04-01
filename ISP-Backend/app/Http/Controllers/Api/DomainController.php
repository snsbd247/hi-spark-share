<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Services\TenantResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DomainController extends Controller
{
    /**
     * List domains for the current tenant.
     */
    public function index()
    {
        $tenant = tenant();
        if (!$tenant) {
            return response()->json(['error' => 'No tenant context'], 400);
        }

        return response()->json([
            'data' => $tenant->domains()->orderBy('is_primary', 'desc')->get(),
            'subdomain' => $tenant->subdomain,
        ]);
    }

    /**
     * Add a custom domain with enhanced validation.
     */
    public function store(Request $request)
    {
        $tenant = tenant();
        if (!$tenant) {
            return response()->json(['error' => 'No tenant context'], 400);
        }

        $request->validate([
            'domain' => [
                'required',
                'string',
                'max:253',
                'unique:domains,domain',
                function ($attribute, $value, $fail) {
                    $d = strtolower(trim($value));

                    // Format check
                    if (!preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i', $d)) {
                        $fail('Invalid domain format.');
                        return;
                    }

                    // Block reserved/central domains
                    $blocked = array_filter(array_map('trim', explode(',', env('CENTRAL_DOMAINS', 'smartispapp.com'))));
                    $blocked = array_merge($blocked, ['localhost', 'example.com', 'test.com']);
                    foreach ($blocked as $b) {
                        if ($d === $b || str_ends_with($d, ".{$b}")) {
                            $fail('This domain is reserved and cannot be used.');
                            return;
                        }
                    }

                    // Each label max 63 chars
                    foreach (explode('.', $d) as $label) {
                        if (strlen($label) > 63) {
                            $fail('Each part of the domain must be 63 characters or less.');
                            return;
                        }
                    }
                },
            ],
        ]);

        $domain = $tenant->domains()->create([
            'id' => Str::uuid(),
            'domain' => strtolower(trim($request->domain)),
            'is_primary' => $tenant->domains()->count() === 0,
            'is_verified' => false,
        ]);

        TenantResolver::flushCache($domain->domain);

        return response()->json([
            'message' => 'Domain added successfully. Configure DNS to complete setup.',
            'data' => $domain,
            'dns_instructions' => $this->generateDnsInstructions($domain->domain, $tenant->subdomain),
        ], 201);
    }

    /**
     * Set a domain as primary.
     */
    public function setPrimary(string $id)
    {
        $tenant = tenant();
        if (!$tenant) return response()->json(['error' => 'No tenant context'], 400);

        $domain = $tenant->domains()->findOrFail($id);
        $tenant->domains()->update(['is_primary' => false]);
        $domain->update(['is_primary' => true]);

        return response()->json(['message' => 'Primary domain updated']);
    }

    /**
     * Remove a custom domain.
     */
    public function destroy(string $id)
    {
        $tenant = tenant();
        if (!$tenant) return response()->json(['error' => 'No tenant context'], 400);

        $domain = $tenant->domains()->findOrFail($id);
        $domainName = $domain->domain;
        $domain->delete();

        TenantResolver::flushCache($domainName);

        return response()->json(['message' => 'Domain removed']);
    }

    /**
     * Verify domain DNS with enhanced checks.
     */
    public function verify(string $id)
    {
        $tenant = tenant();
        if (!$tenant) return response()->json(['error' => 'No tenant context'], 400);

        $domain = $tenant->domains()->findOrFail($id);
        $serverIp = env('SERVER_IP', '');

        // Multi-method verification
        $results = [];

        // 1. Check A record
        $resolved = @gethostbyname($domain->domain);
        $aRecordMatch = $serverIp && $resolved !== $domain->domain && $resolved === $serverIp;
        $results['a_record'] = [
            'resolved' => $resolved !== $domain->domain ? $resolved : null,
            'expected' => $serverIp ?: 'Not configured',
            'match' => $aRecordMatch,
        ];

        // 2. Check CNAME record
        $cnameRecords = @dns_get_record($domain->domain, DNS_CNAME);
        $cnameTarget = null;
        $cnameMatch = false;
        if ($cnameRecords && count($cnameRecords) > 0) {
            $cnameTarget = $cnameRecords[0]['target'] ?? null;
            // Check if CNAME points to our subdomain or central domain
            $centralDomains = array_filter(array_map('trim', explode(',', env('CENTRAL_DOMAINS', 'smartispapp.com'))));
            if ($cnameTarget) {
                foreach ($centralDomains as $central) {
                    if ($cnameTarget === $central || str_ends_with($cnameTarget, ".{$central}")) {
                        $cnameMatch = true;
                        break;
                    }
                }
            }
        }
        $results['cname'] = [
            'target' => $cnameTarget,
            'match' => $cnameMatch,
        ];

        // Verified if either method works
        $verified = $aRecordMatch || $cnameMatch;

        if ($verified) {
            $domain->update(['is_verified' => true]);
            TenantResolver::flushCache($domain->domain);
        }

        // Build message
        if ($verified) {
            $method = $aRecordMatch ? 'A record' : 'CNAME record';
            $message = "Domain verified via {$method}! Your domain is now active.";
        } else {
            $hints = [];
            if (!$serverIp) {
                $hints[] = 'SERVER_IP not configured in .env — cannot verify A records.';
            } elseif ($results['a_record']['resolved']) {
                $hints[] = "A record points to {$results['a_record']['resolved']} but expected {$serverIp}.";
            } else {
                $hints[] = 'No A record found for this domain.';
            }
            if (!$cnameTarget) {
                $hints[] = 'No CNAME record found.';
            } elseif (!$cnameMatch) {
                $hints[] = "CNAME points to {$cnameTarget} which is not a recognized domain.";
            }
            $message = 'DNS not yet pointing to server. ' . implode(' ', $hints);
        }

        return response()->json([
            'verified' => $verified,
            'message' => $message,
            'details' => $results,
        ]);
    }

    /**
     * Generate DNS setup instructions for a domain.
     */
    private function generateDnsInstructions(string $domain, ?string $subdomain): array
    {
        $parts = explode('.', $domain);
        $hostPart = count($parts) > 2 ? $parts[0] : '@';
        $rootDomain = count($parts) > 2 ? implode('.', array_slice($parts, 1)) : $domain;
        $serverIp = env('SERVER_IP', 'YOUR_SERVER_IP');
        $cnameTarget = $subdomain
            ? "{$subdomain}.smartispapp.com"
            : 'smartispapp.com';

        return [
            'option_a' => [
                'label' => 'A Record (Direct IP)',
                'records' => [
                    ['type' => 'A', 'name' => $hostPart, 'value' => $serverIp, 'ttl' => 300],
                ],
                'notes' => "Add this record in {$rootDomain}'s DNS management panel.",
            ],
            'option_b' => [
                'label' => 'CNAME Record (Recommended for Cloudflare)',
                'records' => [
                    ['type' => 'CNAME', 'name' => $hostPart, 'value' => $cnameTarget, 'ttl' => 300],
                ],
                'notes' => 'Enable Cloudflare proxy (orange cloud) for automatic SSL. Not usable for root/apex domains.',
            ],
        ];
    }
}
