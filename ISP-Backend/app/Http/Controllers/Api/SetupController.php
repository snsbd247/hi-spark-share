<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use App\Services\SystemResetService;

/**
 * HTTP-based setup controller for cPanel environments without SSH access.
 * Secured by a setup_token that must match APP_KEY.
 */
class SetupController extends Controller
{
    /**
     * Verify the setup token matches a secure value.
     */
    private function authorize(Request $request): bool
    {
        $token = $request->header('X-Setup-Token', $request->input('setup_token'));
        $appKey = config('app.key');
        
        // The setup token must match the APP_KEY (base64 encoded part)
        if (!$token || !$appKey) return false;
        
        $cleanKey = str_replace('base64:', '', $appKey);
        return hash_equals($cleanKey, $token);
    }

    /**
     * GET /api/setup/status — check system status (public, no sensitive data)
     */
    public function status()
    {
        $tables = [
            'users', 'custom_roles', 'user_roles', 'permissions', 'role_permissions',
            'customers', 'bills', 'payments', 'packages', 'mikrotik_routers',
            'accounts', 'transactions', 'geo_divisions', 'geo_districts', 'geo_upazilas',
            'general_settings', 'system_settings', 'sms_settings',
            'cache', 'admin_sessions',
        ];

        $status = [];
        foreach ($tables as $t) {
            $exists = Schema::hasTable($t);
            $status[$t] = [
                'exists' => $exists,
                'count' => $exists ? \DB::table($t)->count() : 0,
            ];
        }

        return response()->json([
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'tables' => $status,
            'migrations_pending' => $this->pendingMigrations(),
        ]);
    }

    /**
     * POST /api/setup/migrate — run pending migrations
     */
    public function migrate(Request $request)
    {
        if (!$this->authorize($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        try {
            Artisan::call('migrate', ['--force' => true, '--no-interaction' => true]);
            $output = Artisan::output();
            return response()->json(['success' => true, 'output' => $output]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/setup/seed — run seeders
     */
    public function seed(Request $request)
    {
        if (!$this->authorize($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $class = $request->input('class', 'DatabaseSeeder');
        $allowed = ['DatabaseSeeder', 'DefaultSeeder', 'GeoSeeder'];
        
        if (!in_array($class, $allowed)) {
            return response()->json(['error' => 'Invalid seeder class'], 400);
        }

        try {
            Artisan::call('db:seed', [
                '--class' => $class,
                '--force' => true,
                '--no-interaction' => true,
            ]);
            $output = Artisan::output();
            return response()->json(['success' => true, 'output' => $output]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/setup/cache-clear — clear all caches
     */
    public function cacheClear(Request $request)
    {
        if (!$this->authorize($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $results = [];
        foreach (['config:clear', 'cache:clear', 'route:clear', 'view:clear'] as $cmd) {
            try {
                Artisan::call($cmd);
                $results[$cmd] = 'ok';
            } catch (\Exception $e) {
                $results[$cmd] = $e->getMessage();
            }
        }

        // Re-cache for production
        foreach (['config:cache', 'route:cache', 'view:cache'] as $cmd) {
            try {
                Artisan::call($cmd);
                $results[$cmd] = 'ok';
            } catch (\Exception $e) {
                $results[$cmd] = $e->getMessage();
            }
        }

        return response()->json(['success' => true, 'results' => $results]);
    }

    /**
     * POST /api/setup/storage-link — create storage symlink
     */
    public function storageLink(Request $request)
    {
        if (!$this->authorize($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        try {
            Artisan::call('storage:link');
            return response()->json(['success' => true, 'output' => Artisan::output()]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/setup/full — run complete setup (migrate + seed + cache)
     */
    public function full(Request $request)
    {
        if (!$this->authorize($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $results = [];

        // 1. Migrate
        try {
            Artisan::call('migrate', ['--force' => true, '--no-interaction' => true]);
            $results['migrate'] = ['success' => true, 'output' => Artisan::output()];
        } catch (\Exception $e) {
            $results['migrate'] = ['success' => false, 'error' => $e->getMessage()];
        }

        // 2. Default Seed
        try {
            Artisan::call('db:seed', ['--class' => 'DefaultSeeder', '--force' => true, '--no-interaction' => true]);
            $results['default_seed'] = ['success' => true, 'output' => Artisan::output()];
        } catch (\Exception $e) {
            $results['default_seed'] = ['success' => false, 'error' => $e->getMessage()];
        }

        // 3. Geo Seed
        try {
            Artisan::call('db:seed', ['--class' => 'GeoSeeder', '--force' => true, '--no-interaction' => true]);
            $results['geo_seed'] = ['success' => true, 'output' => Artisan::output()];
        } catch (\Exception $e) {
            $results['geo_seed'] = ['success' => false, 'error' => $e->getMessage()];
        }

        // 4. Cache
        try {
            Artisan::call('config:cache');
            Artisan::call('route:cache');
            $results['cache'] = ['success' => true];
        } catch (\Exception $e) {
            $results['cache'] = ['success' => false, 'error' => $e->getMessage()];
        }

        // 5. Storage link
        try {
            Artisan::call('storage:link');
            $results['storage'] = ['success' => true];
        } catch (\Exception $e) {
            $results['storage'] = ['success' => false, 'error' => $e->getMessage()];
        }

        return response()->json(['success' => true, 'results' => $results]);
    }

    private function pendingMigrations(): int
    {
        try {
            Artisan::call('migrate:status', ['--no-interaction' => true]);
            $output = Artisan::output();
            return substr_count($output, 'Pending');
        } catch (\Exception $e) {
            return -1;
        }
    }

    /**
     * POST /api/setup/reset-all — Reset all business data
     */
    public function resetAll(Request $request)
    {
        if (!$this->authorize($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $service = new SystemResetService();
        $result = $service->resetAllData(
            includeSettings: (bool) $request->input('include_settings', false),
            includeAccounts: (bool) $request->input('include_accounts', true),
        );

        return response()->json($result, $result['success'] ? 200 : 500);
    }

    /**
     * POST /api/setup/tenant-setup — Run tenant setup (queue or sync)
     */
    public function tenantSetup(Request $request)
    {
        if (!$this->authorize($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $tenantId = $request->input('tenant_id');
        if (!$tenantId) {
            return response()->json(['success' => false, 'message' => 'tenant_id required'], 400);
        }

        $tenant = \App\Models\Tenant::find($tenantId);
        if (!$tenant) {
            return response()->json(['success' => false, 'message' => 'Tenant not found'], 404);
        }

        try {
            $mode = $request->input('mode', 'sync'); // sync or queue
            $step = $request->input('step'); // optional: geo, accounts, templates, ledger

            $service = new \App\Services\TenantSetupService();

            if ($mode === 'queue') {
                \App\Jobs\SetupTenantJob::dispatch($tenant);
                return response()->json(['success' => true, 'message' => 'Setup jobs dispatched to queue']);
            }

            // Sync mode
            if ($step) {
                $method = 'import' . ucfirst($step);
                if (!method_exists($service, $method)) {
                    return response()->json(['success' => false, 'message' => 'Invalid step'], 400);
                }
                $result = $service->$method($tenant);
                return response()->json($result, $result['success'] ? 200 : 500);
            }

            $result = $service->setupTenant($tenant);
            return response()->json($result, $result['success'] ? 200 : 500);
        } catch (\Exception $e) {
            \Log::error('[TenantSetup API] ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Setup failed. Please try again.',
                'error_code' => 'SETUP_FAILED',
            ], 500);
        }
    }
}
