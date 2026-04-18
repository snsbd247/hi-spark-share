<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Tenant;
use Illuminate\Support\Facades\Hash;

class CustomerIdGenerator
{
    public const DEFAULT_PPPOE_PASSWORD = '123456789';

    /**
     * Derive prefix from tenant subdomain (e.g. "snb.smartispapp.com" or "snb" → "SNB").
     * Falls back to "CUS" if tenant/subdomain unavailable.
     */
    public static function prefixForTenant(?string $tenantId): string
    {
        if (!$tenantId) return 'CUS';

        $tenant = Tenant::find($tenantId);
        if (!$tenant) return 'CUS';

        $sub = $tenant->subdomain ?? '';
        if (!$sub) {
            // fall back to first word of tenant name
            $sub = preg_replace('/[^a-zA-Z0-9]/', '', $tenant->name ?? '');
        }

        // Take part before first dot, strip non-alphanum, uppercase, max 6 chars
        $prefix = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', explode('.', $sub)[0] ?? ''));
        $prefix = substr($prefix, 0, 6);

        return $prefix !== '' ? $prefix : 'CUS';
    }

    /**
     * Generate next available customer code "PREFIX000001" for given tenant.
     * Skips numbers already in use (handles manually inserted codes).
     */
    public static function nextCode(?string $tenantId): string
    {
        $prefix = self::prefixForTenant($tenantId);

        $query = Customer::where('customer_id', 'like', $prefix . '%');
        if ($tenantId) $query->where('tenant_id', $tenantId);

        // Get max sequential number with this prefix
        $existing = $query->pluck('customer_id');
        $maxNum = 0;
        foreach ($existing as $code) {
            $tail = substr($code, strlen($prefix));
            if (ctype_digit($tail)) {
                $n = (int) $tail;
                if ($n > $maxNum) $maxNum = $n;
            }
        }

        $next = $maxNum + 1;
        // Ensure uniqueness even across tenants (customer_id has global UNIQUE constraint)
        do {
            $code = $prefix . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
            $exists = Customer::where('customer_id', $code)->exists();
            $next++;
        } while ($exists);

        return $code;
    }

    /**
     * Apply auto-generation + duplicate validation + default PPPoE password.
     * Mutates and returns the input array. Throws \RuntimeException on duplicate.
     */
    public static function applyDefaults(array $input, ?string $tenantId): array
    {
        // ── customer_id ──
        $customerId = trim((string) ($input['customer_id'] ?? ''));
        if ($customerId === '') {
            $customerId = self::nextCode($tenantId);
        } else {
            if (Customer::where('customer_id', $customerId)->exists()) {
                throw new \RuntimeException("Customer ID '{$customerId}' already exists. Please use a different one or leave it blank to auto-generate.");
            }
        }
        $input['customer_id'] = $customerId;

        // ── pppoe_username (defaults to customer_id when blank) ──
        $pppoe = trim((string) ($input['pppoe_username'] ?? ''));
        if ($pppoe === '') {
            $pppoe = $customerId;
        }
        // Duplicate check (only if it differs from chosen customer_id, since blank-default reuses it)
        $dupQuery = Customer::where('pppoe_username', $pppoe);
        if (!empty($input['id'])) $dupQuery->where('id', '!=', $input['id']);
        if ($dupQuery->exists()) {
            throw new \RuntimeException("PPPoE username '{$pppoe}' already exists. Please use a different one or leave it blank to auto-generate.");
        }
        $input['pppoe_username'] = $pppoe;

        // ── pppoe_password (default 123456789 if blank) ──
        $password = (string) ($input['pppoe_password'] ?? '');
        if ($password === '') {
            $password = self::DEFAULT_PPPOE_PASSWORD;
        }
        $input['pppoe_password'] = $password;
        $input['pppoe_password_hash'] = Hash::make($password);

        return $input;
    }
}
