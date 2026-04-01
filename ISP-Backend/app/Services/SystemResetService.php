<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class SystemResetService
{
    /**
     * Tables that must NEVER be truncated.
     */
    private const PROTECTED_TABLES = [
        'users',
        'custom_roles',
        'user_roles',
        'permissions',
        'role_permissions',
        'migrations',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'sessions',
    ];

    /**
     * Tables that should also be preserved (settings/config).
     */
    private const PRESERVE_TABLES = [
        'general_settings',
        'system_settings',
        'sms_settings',
    ];

    /**
     * Child tables that must be truncated BEFORE their parents (FK-safe order).
     * Listed from deepest child → parent.
     */
    private const TRUNCATE_ORDER = [
        // ── Deep children first ──
        'admin_login_logs',
        'admin_sessions',
        'audit_logs',
        'backup_logs',
        'reminder_logs',
        'sms_logs',
        'daily_reports',

        // ── Customer children ──
        'customer_ledger',
        'customer_sessions',
        'ticket_replies',
        'support_tickets',
        'merchant_payments',
        'payments',
        'bills',
        'onus',

        // ── Sales & Purchases children ──
        'sale_items',
        'sales',
        'purchase_items',
        'supplier_payments',
        'purchases',

        // ── HR children ──
        'employee_education',
        'employee_emergency_contacts',
        'employee_experience',
        'employee_provident_fund',
        'employee_salary_structure',
        'employee_savings_fund',
        'salary_sheets',
        'loans',
        'attendance',

        // ── Master tables ──
        'customers',
        'employees',
        'designations',
        'products',
        'expenses',
        'expense_heads',
        'income_heads',
        'other_heads',
        'vendors',
        'suppliers',
        'packages',
        'mikrotik_routers',
        'payment_gateways',
        'olts',

        // ── Accounting ──
        'transactions',
        'accounts',

        // ── Geo Data ──
        'geo_upazilas',
        'geo_districts',
        'geo_divisions',

        // ── Templates ──
        'sms_templates',
    ];

    /**
     * Reset all business data. Users, roles, permissions & settings are preserved.
     *
     * @param  bool  $includeSettings  Also reset settings tables
     * @param  bool  $includeAccounts  Also reset Chart of Accounts
     * @return array  Summary of what was reset
     */
    public function resetAllData(bool $includeSettings = false, bool $includeAccounts = true): array
    {
        $truncated = [];
        $skipped   = [];
        $errors    = [];

        // Build the protected list
        $protected = array_merge(self::PROTECTED_TABLES, $includeSettings ? [] : self::PRESERVE_TABLES);

        DB::beginTransaction();

        try {
            // Disable FK checks for MySQL (safe truncate)
            DB::statement('SET FOREIGN_KEY_CHECKS=0');

            // Phase 1: Truncate in defined order
            foreach (self::TRUNCATE_ORDER as $table) {
                if (in_array($table, $protected)) {
                    $skipped[] = $table;
                    continue;
                }
                if (!$includeAccounts && in_array($table, ['accounts', 'transactions'])) {
                    $skipped[] = $table;
                    continue;
                }
                if (Schema::hasTable($table)) {
                    try {
                        DB::table($table)->truncate();
                        $truncated[] = $table;
                    } catch (\Exception $e) {
                        $errors[] = "{$table}: {$e->getMessage()}";
                        Log::error("Reset failed for {$table}: " . $e->getMessage());
                    }
                }
            }

            // Phase 2: Catch any remaining tables not in the explicit order
            $allTables = $this->getAllTableNames();
            $alreadyHandled = array_merge(self::TRUNCATE_ORDER, $protected);
            if (!$includeAccounts) {
                $alreadyHandled[] = 'accounts';
                $alreadyHandled[] = 'transactions';
            }

            foreach ($allTables as $table) {
                if (in_array($table, $alreadyHandled) || in_array($table, $truncated)) {
                    continue;
                }
                // Skip any remaining protected
                if (in_array($table, $protected)) {
                    $skipped[] = $table;
                    continue;
                }
                try {
                    DB::table($table)->truncate();
                    $truncated[] = $table;
                } catch (\Exception $e) {
                    $errors[] = "{$table}: {$e->getMessage()}";
                }
            }

            // Re-enable FK checks
            DB::statement('SET FOREIGN_KEY_CHECKS=1');

            DB::commit();

            // Post-reset: clear caches
            try {
                Artisan::call('cache:clear');
            } catch (\Exception $e) {
                // Ignore cache clear failures
            }

            return [
                'success'   => true,
                'truncated' => $truncated,
                'skipped'   => $skipped,
                'errors'    => $errors,
                'message'   => 'System reset completed. ' . count($truncated) . ' tables cleared.',
            ];
        } catch (\Exception $e) {
            DB::rollBack();

            // Always re-enable FK checks
            try {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            } catch (\Exception $ignored) {}

            Log::error('System reset failed: ' . $e->getMessage());

            return [
                'success' => false,
                'error'   => $e->getMessage(),
                'message' => 'System reset failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get all table names in the current database.
     */
    private function getAllTableNames(): array
    {
        $tables = [];
        $results = DB::select('SHOW TABLES');

        foreach ($results as $row) {
            $values = get_object_vars($row);
            $tables[] = reset($values);
        }

        return $tables;
    }
}