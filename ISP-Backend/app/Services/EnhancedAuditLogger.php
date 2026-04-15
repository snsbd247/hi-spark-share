<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class EnhancedAuditLogger
{
    /**
     * Log an audit trail entry with full context.
     */
    public static function log(
        string $actionType,
        string $tableName,
        string $recordId,
        ?array $oldData = null,
        ?array $newData = null,
        ?string $module = null,
        ?string $userId = null,
        ?string $userName = null,
        ?string $tenantId = null,
        ?Request $request = null
    ): void {
        try {
            $req = $request ?? request();

            AuditLog::create([
                'admin_id'   => $userId ?? '00000000-0000-0000-0000-000000000000',
                'admin_name' => $userName ?? 'System',
                'action'     => $actionType,
                'table_name' => $tableName,
                'record_id'  => $recordId,
                'old_data'   => $oldData,
                'new_data'   => $newData,
                'module'     => $module ?? self::guessModule($tableName),
                'tenant_id'  => $tenantId ?? tenant_id(),
                'user_id'    => $userId,
                'ip_address' => $req->ip(),
                'user_agent' => $req->userAgent(),
            ]);
        } catch (\Throwable $e) {
            \Log::warning('Enhanced audit log failed: ' . $e->getMessage());
        }
    }

    /**
     * Guess the module from table name.
     */
    private static function guessModule(string $tableName): string
    {
        return self::guessModulePublic($tableName);
    }

    /**
     * Public method to guess the module from table name.
     */
    public static function guessModulePublic(string $tableName): string
    {
        $map = [
            'customers'         => 'customers',
            'bills'             => 'billing',
            'payments'          => 'payments',
            'packages'          => 'settings',
            'expenses'          => 'accounting',
            'products'          => 'inventory',
            'employees'         => 'hr',
            'admin_sessions'    => 'security',
            'general_settings'  => 'settings',
            'system_settings'   => 'settings',
            'mikrotik_routers'  => 'settings',
            'resellers'         => 'resellers',
            'custom_roles'      => 'roles',
            'tenants'           => 'tenants',
            'users'             => 'users',
            'profiles'          => 'users',
        ];

        return $map[$tableName] ?? 'system';
    }
}
