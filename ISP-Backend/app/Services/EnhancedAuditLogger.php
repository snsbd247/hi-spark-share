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
            'accounts'          => 'accounting',
            'transactions'      => 'accounting',
            'products'          => 'inventory',
            'product_serials'   => 'inventory',
            'customer_devices'  => 'inventory',
            'inventory_logs'    => 'inventory',
            'categories'        => 'inventory',
            'purchases'         => 'inventory',
            'purchase_items'    => 'inventory',
            'sales'             => 'inventory',
            'sale_items'        => 'inventory',
            'employees'         => 'hr',
            'attendance'        => 'hr',
            'salary_sheets'     => 'hr',
            'loans'             => 'hr',
            'designations'      => 'hr',
            'employee_salary_structure'     => 'hr',
            'employee_provident_fund'       => 'hr',
            'employee_savings_fund'         => 'hr',
            'employee_education'            => 'hr',
            'employee_experience'           => 'hr',
            'employee_emergency_contacts'   => 'hr',
            'admin_sessions'    => 'security',
            'general_settings'  => 'settings',
            'system_settings'   => 'settings',
            'billing_config'    => 'settings',
            'payment_gateways'  => 'settings',
            'sms_settings'      => 'settings',
            'sms_templates'     => 'settings',
            'smtp_settings'     => 'settings',
            'mikrotik_routers'  => 'settings',
            'resellers'         => 'resellers',
            'reseller_commissions'          => 'resellers',
            'reseller_packages'             => 'resellers',
            'reseller_wallet_transactions'  => 'resellers',
            'reseller_zones'                => 'resellers',
            'custom_roles'      => 'roles',
            'role_permissions'  => 'roles',
            'tenants'           => 'tenants',
            'domains'           => 'tenants',
            'tenant_company_info'           => 'tenants',
            'subscriptions'     => 'tenants',
            'subscription_invoices'         => 'tenants',
            'users'             => 'users',
            'user_roles'        => 'users',
            'profiles'          => 'users',
            'support_tickets'   => 'tickets',
            'ticket_replies'    => 'tickets',
            'suppliers'         => 'supplier',
            'supplier_payments' => 'supplier',
            'landing_sections'  => 'cms',
            'demo_requests'     => 'cms',
            'contact_messages'  => 'cms',
            'faqs'              => 'cms',
            'coupons'           => 'billing',
            'zones'             => 'settings',
            'ip_pools'          => 'settings',
            'fiber_olts'        => 'fiber_network',
            'fiber_cables'      => 'fiber_network',
            'fiber_cores'       => 'fiber_network',
            'fiber_pon_ports'   => 'fiber_network',
            'fiber_splitters'   => 'fiber_network',
            'fiber_splitter_outputs' => 'fiber_network',
            'fiber_onus'        => 'fiber_network',
            'network_nodes'     => 'network_map',
            'network_links'     => 'network_map',
            'core_connections'  => 'fiber_network',
        ];

        return $map[$tableName] ?? 'system';
    }
}
