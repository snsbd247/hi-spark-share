<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Production-grade Tenant Setup Service.
 * Seeds tenant-specific data with transaction safety and rollback.
 */
class TenantSetupService
{
    // ─── Public API ─────────────────────────────────────────

    /**
     * Run full setup for a tenant (all 4 steps).
     */
    public function setupTenant(Tenant $tenant): array
    {
        $results = [];

        $steps = [
            'geo'       => fn() => $this->importGeo($tenant),
            'accounts'  => fn() => $this->importAccounts($tenant),
            'templates' => fn() => $this->importTemplates($tenant),
            'ledger'    => fn() => $this->importLedger($tenant),
        ];

        foreach ($steps as $key => $fn) {
            $results[$key] = $fn();
        }

        $allSuccess = collect($results)->every(fn($r) => $r['success']);

        if ($allSuccess) {
            $tenant->update(['setup_status' => 'completed']);
        }

        return [
            'success' => $allSuccess,
            'message' => $allSuccess ? 'Full setup completed' : 'Some steps failed',
            'results' => $results,
        ];
    }

    // ─── 1. Geo Data ────────────────────────────────────────

    public function importGeo(Tenant $tenant): array
    {
        return $this->runStep('geo', $tenant, function () use ($tenant) {
            $data = $this->loadJson('geo.json');
            if (!$data) {
                throw new \RuntimeException('geo.json not found or invalid');
            }

            $totalInserted = 0;
            $divisionIds = [];

            // Divisions — upsert by name (idempotent)
            foreach ($data['divisions'] as $div) {
                $existing = DB::table('geo_divisions')->where('name', $div['name'])->first();
                if ($existing) {
                    $divisionIds[$div['name']] = $existing->id;
                    continue;
                }
                $id = Str::uuid()->toString();
                DB::table('geo_divisions')->insert([
                    'id'         => $id,
                    'name'       => $div['name'],
                    'bn_name'    => $div['bn_name'] ?? null,
                    'status'     => 'active',
                    'created_at' => now(),
                ]);
                $divisionIds[$div['name']] = $id;
                $totalInserted++;
            }

            // Districts — upsert by (division_id, name)
            $districtIds = [];
            foreach ($data['districts'] as $divName => $districts) {
                $divId = $divisionIds[$divName] ?? null;
                if (!$divId) continue;

                foreach ($districts as $dist) {
                    $existing = DB::table('geo_districts')
                        ->where('division_id', $divId)
                        ->where('name', $dist['name'])
                        ->first();
                    if ($existing) {
                        $districtIds[$dist['name']] = $existing->id;
                        continue;
                    }
                    $id = Str::uuid()->toString();
                    DB::table('geo_districts')->insert([
                        'id'          => $id,
                        'division_id' => $divId,
                        'name'        => $dist['name'],
                        'bn_name'     => $dist['bn_name'] ?? null,
                        'status'      => 'active',
                        'created_at'  => now(),
                    ]);
                    $districtIds[$dist['name']] = $id;
                    $totalInserted++;
                }
            }

            // Upazilas — upsert by (district_id, name) so missing rows get added
            foreach ($data['upazilas'] as $distName => $upazilas) {
                $distId = $districtIds[$distName] ?? null;
                if (!$distId) continue;

                foreach ($upazilas as $upa) {
                    $name = is_array($upa) ? $upa['name'] : $upa;
                    $bnName = is_array($upa) ? ($upa['bn_name'] ?? null) : null;

                    $exists = DB::table('geo_upazilas')
                        ->where('district_id', $distId)
                        ->where('name', $name)
                        ->exists();
                    if ($exists) continue;

                    DB::table('geo_upazilas')->insert([
                        'id'          => Str::uuid()->toString(),
                        'district_id' => $distId,
                        'name'        => $name,
                        'bn_name'     => $bnName,
                        'status'      => 'active',
                        'created_at'  => now(),
                    ]);
                    $totalInserted++;
                }
            }

            return ['success' => true, 'message' => "Geo data imported/updated", 'count' => $totalInserted];
        });
    }

    // ─── 2. Chart of Accounts ───────────────────────────────

    public function importAccounts(Tenant $tenant): array
    {
        return $this->runStep('accounts', $tenant, function () use ($tenant) {
            $data = $this->loadJson('accounts.json');
            if (!$data) {
                throw new \RuntimeException('accounts.json not found or invalid');
            }

            // Sort by level to ensure parents created first
            usort($data, fn($a, $b) => ($a['level'] ?? 0) <=> ($b['level'] ?? 0));

            $codeToId = DB::table('accounts')
                ->where('tenant_id', $tenant->id)
                ->whereNotNull('code')
                ->pluck('id', 'code')
                ->toArray();

            $count = 0;

            foreach ($data as $acct) {
                $code = $acct['code'] ?? null;
                if (!$code || isset($codeToId[$code])) {
                    continue;
                }

                $parentId = null;
                if (!empty($acct['parent_code']) && isset($codeToId[$acct['parent_code']])) {
                    $parentId = $codeToId[$acct['parent_code']];
                }

                $id = Str::uuid()->toString();
                DB::table('accounts')->insert([
                    'id'        => $id,
                    'tenant_id' => $tenant->id,
                    'name'      => $acct['name'],
                    'code'      => $acct['code'],
                    'type'      => $acct['type'],
                    'level'     => $acct['level'] ?? 0,
                    'is_system' => $acct['is_system'] ?? false,
                    'parent_id' => $parentId,
                    'balance'   => 0,
                    'status'    => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $codeToId[$code] = $id;
                $count++;
            }

            // Store code-to-id mapping for ledger step
            $tenant->setRelation('_coaMap', collect($codeToId));

            return [
                'success' => true,
                'message' => $count > 0 ? 'Chart of Accounts synced' : 'Chart of Accounts already synced',
                'count' => $count,
            ];
        });
    }

    // ─── 3. SMS/Email Templates ─────────────────────────────

    public function importTemplates(Tenant $tenant): array
    {
        return $this->runStep('templates', $tenant, function () use ($tenant) {
            $data = $this->loadJson('templates.json');
            if (!$data) {
                throw new \RuntimeException('templates.json not found or invalid');
            }

            $count = 0;
            foreach ($data['sms'] as $tpl) {
                $exists = DB::table('sms_templates')
                    ->where('tenant_id', $tenant->id)
                    ->where('name', $tpl['name'])
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('sms_templates')->insert([
                    'id'         => Str::uuid()->toString(),
                    'tenant_id'  => $tenant->id,
                    'name'       => $tpl['name'],
                    'message'    => $tpl['message'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $count++;
            }

            // Email templates as system_settings
            if (!empty($data['email'])) {
                foreach ($data['email'] as $key => $value) {
                    $exists = DB::table('system_settings')
                        ->where('tenant_id', $tenant->id)
                        ->where('setting_key', $key)
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    DB::table('system_settings')->insert([
                        'id'            => Str::uuid()->toString(),
                        'tenant_id'     => $tenant->id,
                        'setting_key'   => $key,
                        'setting_value' => $value,
                        'created_at'    => now(),
                        'updated_at'    => now(),
                    ]);
                    $count++;
                }
            }

            return [
                'success' => true,
                'message' => $count > 0 ? 'Templates synced' : 'Templates already synced',
                'count' => $count,
            ];
        });
    }

    // ─── 4. Ledger Mappings ─────────────────────────────────

    public function importLedger(Tenant $tenant): array
    {
        return $this->runStep('ledger', $tenant, function () use ($tenant) {
            $data = $this->loadJson('ledger.json');
            if (!$data) {
                throw new \RuntimeException('ledger.json not found or invalid');
            }

            // Build code→id map from tenant's accounts
            $codeToId = DB::table('accounts')
                ->where('tenant_id', $tenant->id)
                ->whereNotNull('code')
                ->pluck('id', 'code')
                ->toArray();

            if (empty($codeToId)) {
                throw new \RuntimeException('No accounts found for tenant. Run accounts import first.');
            }

            $count = 0;

            // Ledger mappings → system_settings
            foreach ($data['mappings'] as $key => $code) {
                $accountId = $codeToId[$code] ?? null;
                if ($accountId) {
                    $this->syncTenantSystemSetting($tenant->id, $key, $accountId);
                    $count++;
                }
            }

            // Expense heads
            if (!empty($data['expense_heads'])) {
                foreach ($data['expense_heads'] as $head) {
                    $exists = DB::table('expense_heads')
                        ->where('tenant_id', $tenant->id)
                        ->where('name', $head['name'])
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    DB::table('expense_heads')->insert([
                        'id'          => Str::uuid()->toString(),
                        'tenant_id'   => $tenant->id,
                        'name'        => $head['name'],
                        'description' => $head['description'] ?? null,
                        'status'      => 'active',
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                    $count++;
                }
            }

            // Income heads
            if (!empty($data['income_heads'])) {
                foreach ($data['income_heads'] as $head) {
                    $exists = DB::table('income_heads')
                        ->where('tenant_id', $tenant->id)
                        ->where('name', $head['name'])
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    DB::table('income_heads')->insert([
                        'id'          => Str::uuid()->toString(),
                        'tenant_id'   => $tenant->id,
                        'name'        => $head['name'],
                        'description' => $head['description'] ?? null,
                        'status'      => 'active',
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                    $count++;
                }
            }

            return ['success' => true, 'message' => 'Ledger settings synced', 'count' => $count];
        });
    }

    // ─── Helpers ─────────────────────────────────────────────

    /**
     * Run a setup step inside a DB transaction with error handling.
     */
    private function runStep(string $step, Tenant $tenant, callable $fn): array
    {
        try {
            DB::beginTransaction();

            $result = $fn();

            // Update tenant setup flag
            if ($result['success']) {
                $tenant->update(["setup_{$step}" => true]);
            }

            DB::commit();

            Log::info("[TenantSetup] {$step} completed for tenant {$tenant->id}", $result);

            return $result;

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error("[TenantSetup] {$step} FAILED for tenant {$tenant->id}", [
                'error'   => $e->getMessage(),
                'file'    => $e->getFile(),
                'line'    => $e->getLine(),
            ]);

            return [
                'success'    => false,
                'message'    => "Failed to import {$step}. Please try again.",
                'error_code' => 'SETUP_' . strtoupper($step) . '_FAILED',
            ];
        }
    }

    /**
     * Create or update a tenant system setting without mutating primary keys.
     */
    private function syncTenantSystemSetting(string $tenantId, string $key, string $value): void
    {
        $existing = DB::table('system_settings')
            ->where('tenant_id', $tenantId)
            ->where('setting_key', $key)
            ->first(['id']);

        if ($existing) {
            DB::table('system_settings')
                ->where('id', $existing->id)
                ->update([
                    'setting_value' => $value,
                    'updated_at' => now(),
                ]);

            return;
        }

        DB::table('system_settings')->insert([
            'id' => Str::uuid()->toString(),
            'tenant_id' => $tenantId,
            'setting_key' => $key,
            'setting_value' => $value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Load JSON data from database/data/ directory.
     */
    private function loadJson(string $filename): ?array
    {
        $path = database_path("data/{$filename}");
        if (!file_exists($path)) {
            return null;
        }

        $json = file_get_contents($path);
        $data = json_decode($json, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error("[TenantSetup] Invalid JSON in {$filename}: " . json_last_error_msg());
            return null;
        }

        return $data;
    }
}
