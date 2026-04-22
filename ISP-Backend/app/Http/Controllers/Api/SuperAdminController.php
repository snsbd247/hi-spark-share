<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Models\Module;
use App\Models\SmsSetting;
use App\Models\SmtpSetting;
use App\Models\SmsWallet;
use App\Models\SmsTransaction;
use App\Models\SaasPlan;
use App\Models\Subscription;
use App\Models\SubscriptionInvoice;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserRole;
use App\Models\CustomRole;
use App\Services\PlanModuleService;
use App\Services\SmsService;
use App\Services\TenantEmailService;
use App\Services\TenantResolver;
use App\Services\ActivityLogger;
use App\Services\EnhancedAuditLogger;
use App\Services\SubscriptionActivationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SuperAdminController extends Controller
{
    // ══════════════════════════════════════════
    // DASHBOARD
    // ══════════════════════════════════════════
    public function dashboard()
    {
        $totalTenants = Tenant::count();
        $activeTenants = Tenant::where('status', 'active')->count();
        $suspendedTenants = Tenant::where('status', 'suspended')->count();
        $trialTenants = Tenant::where('status', 'trial')->count();

        $totalSubscriptions = Subscription::where('status', 'active')->count();
        $monthlyRevenue = Subscription::where('status', 'active')
            ->where('billing_cycle', 'monthly')
            ->sum('amount');
        $yearlyRevenue = Subscription::where('status', 'active')
            ->where('billing_cycle', 'yearly')
            ->sum('amount');

        $recentTenants = Tenant::orderBy('created_at', 'desc')->limit(5)->get();

        $expiringSoon = Subscription::where('status', 'active')
            ->whereBetween('end_date', [now(), now()->addDays(7)])
            ->with('tenant', 'plan')
            ->get();

        return response()->json([
            'stats' => [
                'total_tenants' => $totalTenants,
                'active_tenants' => $activeTenants,
                'suspended_tenants' => $suspendedTenants,
                'trial_tenants' => $trialTenants,
                'active_subscriptions' => $totalSubscriptions,
                'monthly_revenue' => $monthlyRevenue,
                'yearly_revenue' => $yearlyRevenue,
            ],
            'recent_tenants' => $recentTenants,
            'expiring_soon' => $expiringSoon,
        ]);
    }

    // ══════════════════════════════════════════
    // TENANT MANAGEMENT
    // ══════════════════════════════════════════
    public function tenants(Request $request)
    {
        $query = Tenant::with('domains');

        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('subdomain', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%");
            });
        }

        $tenants = $query->orderBy('created_at', 'desc')->get();

        // Attach active subscription info
        $tenants->each(function ($tenant) {
            $sub = Subscription::where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->with('plan')
                ->first();
            $tenant->active_subscription = $sub;
            $tenant->customer_count = \DB::table('customers')
                ->where('tenant_id', $tenant->id)->count();
            $tenant->user_count = \DB::table('users')
                ->where('tenant_id', $tenant->id)->count();
        });

        return response()->json($tenants);
    }

    public function createTenant(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'subdomain' => 'required|string|max:100|unique:tenants,subdomain|alpha_dash',
            'email' => 'required|email',
            'phone' => 'nullable|string|max:20',
            'plan_id' => 'nullable|uuid|exists:saas_plans,id',
            'admin_name' => 'nullable|string|max:255',
            'admin_email' => 'nullable|email',
            'admin_password' => 'nullable|string|min:6',
        ]);

        $adminName = $validated['admin_name'] ?? ($validated['name'] . ' Admin');
        $adminEmail = $validated['admin_email'] ?? $validated['email'];
        $adminPassword = $validated['admin_password'] ?? '123456789';
        $adminUsername = strtolower($validated['subdomain']) . '_admin';

        try {
            $tenant = DB::transaction(function () use ($validated, $adminName, $adminEmail, $adminPassword, $adminUsername) {
                $tenant = Tenant::create([
                    'name' => $validated['name'],
                    'subdomain' => strtolower($validated['subdomain']),
                    'email' => $validated['email'],
                    'phone' => $validated['phone'] ?? null,
                    'status' => 'suspended',
                    'plan' => 'basic',
                ]);

                if (!empty($validated['plan_id'])) {
                    $plan = SaasPlan::findOrFail($validated['plan_id']);
                    $amount = $plan->price_monthly;
                    $sub = Subscription::create([
                        'tenant_id' => $tenant->id,
                        'plan_id' => $plan->id,
                        'billing_cycle' => 'monthly',
                        'start_date' => now()->toDateString(),
                        'end_date' => now()->addMonth()->toDateString(),
                        'status' => 'expired',
                        'amount' => $amount,
                    ]);

                    $tenant->update([
                        'plan' => $plan->slug,
                        'plan_id' => $plan->id,
                        'plan_expire_date' => $sub->end_date,
                        'status' => 'suspended',
                    ]);
                    $this->createSubscriptionInvoice($sub, $plan, $amount);
                }

                $user = User::create([
                    'tenant_id' => $tenant->id,
                    'full_name' => $adminName,
                    'email' => $adminEmail,
                    'mobile' => $validated['phone'] ?? null,
                    'username' => $adminUsername,
                    'password_hash' => Hash::make($adminPassword),
                    'status' => 'active',
                    'must_change_password' => true,
                ]);

                $superAdminRole = CustomRole::where('name', 'Super Admin')->first();
                UserRole::create([
                    'user_id' => $user->id,
                    'role' => 'super_admin',
                    'custom_role_id' => $superAdminRole?->id,
                ]);

                return $tenant->load('domains');
            });
        } catch (\Throwable $e) {
            Log::error('Tenant creation failed', [
                'subdomain' => $validated['subdomain'],
                'email' => $validated['email'],
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'error' => 'Failed to create tenant',
            ], 500);
        }

        $loginUrl = "https://{$tenant->subdomain}.smartispapp.com/admin/login";

        try {
            $emailService = new TenantEmailService();
            $emailService->sendTenantCredentials(
                $tenant->toArray(),
                $adminEmail,
                $adminName,
                $adminPassword,
                $loginUrl
            );
        } catch (\Exception $e) {
            Log::warning('Tenant welcome email failed: ' . $e->getMessage());
        }

        if (!empty($validated['phone'])) {
            try {
                $smsService = new SmsService();
                $smsMessage = "Welcome to Smart ISP! Login: {$loginUrl}, User: {$adminUsername}, Password: {$adminPassword}. Please change your password after first login.";
                $smsService->send($validated['phone'], $smsMessage);
            } catch (\Exception $e) {
                Log::warning('Tenant welcome SMS failed: ' . $e->getMessage());
            }
        }

        $this->logSuperAdminAction(
            $request,
            'create',
            'tenants',
            (string) $tenant->id,
            null,
            $tenant->toArray(),
            "Created tenant {$tenant->name} ({$tenant->subdomain})",
            null,
            [
                'tenant_name' => $tenant->name,
                'tenant_subdomain' => $tenant->subdomain,
                'tenant_email' => $tenant->email,
            ]
        );

        return response()->json([
            'success' => true,
            'tenant' => $tenant,
            'id' => $tenant->id,
        ], 201);
    }

    public function updateTenant(Request $request, string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $oldTenant = $tenant->toArray();

        $data = $request->only([
            'name', 'email', 'phone', 'logo_url', 'status', 'settings',
            'setup_status', 'setup_geo', 'setup_accounts', 'setup_templates',
            'setup_ledger', 'setup_payment_gateways', 'auto_setup',
            'max_users', 'max_customers', 'plan_expire_date', 'grace_days',
            'plan_id', 'plan_expiry_message',
        ]);

        if ($request->has('subdomain') && $request->subdomain !== $tenant->subdomain) {
            $request->validate(['subdomain' => 'required|string|max:100|unique:tenants,subdomain|alpha_dash']);
            $data['subdomain'] = strtolower($request->subdomain);
            TenantResolver::flushTenantCache($tenant);
        }

        $tenant->update($data);

        $updatedTenant = $tenant->load('domains');

        $this->logSuperAdminAction(
            $request,
            'edit',
            'tenants',
            (string) $tenant->id,
            $oldTenant,
            $updatedTenant->toArray(),
            "Updated tenant {$updatedTenant->name} ({$updatedTenant->subdomain})",
            null,
            [
                'tenant_name' => $updatedTenant->name,
                'tenant_subdomain' => $updatedTenant->subdomain,
                'tenant_email' => $updatedTenant->email,
            ]
        );

        return response()->json($updatedTenant);
    }

    public function suspendTenant(Request $request, string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $oldTenant = $tenant->toArray();
        $tenant->update(['status' => 'suspended']);

        // Suspend active subscriptions
        Subscription::where('tenant_id', $id)
            ->where('status', 'active')
            ->update(['status' => 'suspended']);

        TenantResolver::flushTenantCache($tenant);

        $this->logSuperAdminAction(
            $request,
            'edit',
            'tenants',
            (string) $tenant->id,
            $oldTenant,
            $tenant->fresh()->toArray(),
            "Suspended tenant {$tenant->name} ({$tenant->subdomain})",
            null,
            [
                'tenant_name' => $tenant->name,
                'tenant_subdomain' => $tenant->subdomain,
            ]
        );

        return response()->json(['success' => true, 'message' => 'Tenant suspended']);
    }

    public function activateTenant(Request $request, string $id)
    {
        $tenant = Tenant::findOrFail($id);

        // Super admin force-activate: mark pending invoices as paid and activate subscriptions
        $pendingInvoice = SubscriptionInvoice::where('tenant_id', $tenant->id)
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->first();

        if ($pendingInvoice) {
            // Use the activation service to properly activate everything
            SubscriptionActivationService::activateOnInvoicePaid($pendingInvoice->id);
            // Refresh tenant after service updated it
            $tenant->refresh();
        } else {
            // No pending invoice — just activate the subscription if expired
            $expiredSub = Subscription::where('tenant_id', $tenant->id)
                ->where('status', 'expired')
                ->orderBy('created_at', 'desc')
                ->first();

            if ($expiredSub) {
                $billingCycle = $expiredSub->billing_cycle ?: 'monthly';
                $endDate = $billingCycle === 'yearly'
                    ? now()->addYear()->toDateString()
                    : now()->addMonth()->toDateString();

                $expiredSub->update([
                    'status' => 'active',
                    'start_date' => now()->toDateString(),
                    'end_date' => $endDate,
                ]);
            }
        }

        $oldTenant = $tenant->toArray();
        $tenant->update(['status' => 'active']);

        TenantResolver::flushTenantCache($tenant);

        $this->logSuperAdminAction(
            $request,
            'edit',
            'tenants',
            (string) $tenant->id,
            $oldTenant,
            $tenant->fresh()->toArray(),
            "Activated tenant {$tenant->name} ({$tenant->subdomain})",
            null,
            [
                'tenant_name' => $tenant->name,
                'tenant_subdomain' => $tenant->subdomain,
            ]
        );

        return response()->json(['success' => true, 'message' => 'Tenant activated']);
    }

    public function deleteTenant(Request $request, string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $tenantSnapshot = $tenant->toArray();
        TenantResolver::flushTenantCache($tenant);

        // ──────────────────────────────────────────────────────────────
        // FULL CASCADE DELETE — Tenant scoped
        // Strategy:
        //  1. Auto-discover EVERY public table that has a `tenant_id` column
        //     and delete rows where tenant_id = $id. This guarantees future
        //     tenant-scoped tables are cleaned without code changes.
        //  2. Explicitly clean child tables that hang off customers/employees/
        //     users/subscriptions/resellers (no direct tenant_id) — scoped by
        //     parent IDs that belong to this tenant only.
        //  3. NEVER touch rows belonging to other tenants. All deletes are
        //     filtered by tenant_id or by parent IDs scoped to this tenant.
        //  4. Integration credentials are deleted only for the target tenant.
        //     Global SMS config is preserved even if legacy data mistakenly
        //     lived on the tenant row being deleted.
        // ──────────────────────────────────────────────────────────────

        // Tables that MUST be deleted in a specific order (children before parents)
        // because their rows are referenced by FKs from other tenant tables.
        $orderedTenantTables = [
            // Subscriptions chain
            'subscription_invoices', 'subscriptions',
            // Customer children (cleared again later via parent IDs as safety net)
            'customer_ledger', 'customer_sessions', 'customer_devices',
            'customer_bandwidth_usages', 'customer_reseller_migrations',
            // Billing chain
            'reminder_logs', 'payments', 'bills',
            // Sales / purchases
            'sale_items', 'sales', 'purchase_items', 'purchases',
            'merchant_payments', 'supplier_payments',
            'inventory_logs', 'product_serials',
            // Reseller chain
            'reseller_commissions', 'reseller_package_commissions',
            'reseller_wallet_transactions', 'reseller_sessions',
            'reseller_packages',
            // Fiber / network chain (deepest first)
            'onu_signal_history', 'onu_alert_logs', 'onu_alert_rules',
            'onu_live_status', 'onu_mikrotik_sync_logs',
            'core_connections', 'fiber_cores', 'fiber_cables',
            'fiber_splitter_outputs', 'fiber_splitters', 'fiber_pon_ports',
            'fiber_onus', 'fiber_olts',
            'olt_polling_logs', 'olt_devices',
            'network_links', 'network_nodes',
            'online_sessions',
            // HR
            'employee_provident_fund', 'employee_salary_structure',
            'employee_savings_fund', 'attendance', 'salary_sheets', 'loans',
            // Support
            'ticket_replies', 'support_tickets',
            // SMS / notifications
            'sms_logs', 'sms_transactions', 'sms_wallets', 'sms_templates',
            'notifications',
            // Audit / sessions
            'login_histories', 'impersonations',
            'activity_logs', 'audit_logs', 'admin_login_logs', 'admin_sessions',
            // Now safe to drop main entities
            'customers',
            'reseller_zones', 'resellers', 'zones',
            'employees', 'designations',
            'expenses', 'expense_heads', 'income_heads', 'other_heads',
            'packages', 'ip_pools',
            'mikrotik_routers', 'olts', 'onus',
            'categories', 'products', 'suppliers',
            // Integrations (tenant row only — global defaults untouched)
            // NOTE: 'sms_settings' intentionally EXCLUDED from this list.
            // Global SMS gateway (GreenWeb) lives with tenant_id = NULL and
            // must NEVER be deleted with a tenant. We handle sms_settings
            // separately below with an explicit `tenant_id IS NOT NULL` guard.
            'smtp_settings', 'payment_gateways',
            // Settings / config
            'general_settings', 'system_settings', 'billing_config',
            'tenant_company_info',
            // Accounting
            'transactions', 'accounts',
            // RBAC
            'role_permissions', 'user_roles', 'custom_roles',
            // Reporting
            'daily_reports',
            // Misc tenant-owned
            'demo_requests', 'profiles', 'domains',
        ];

        $smsGatewayGuard = null;

        DB::beginTransaction();
        try {
            $smsGatewayGuard = $this->preserveGlobalSmsSettingsForTenantDelete($id);

            // ── Step 1: clean child rows scoped by parent IDs (no tenant_id column) ──
            $customerIds = DB::table('customers')->where('tenant_id', $id)->pluck('id');
            if ($customerIds->isNotEmpty()) {
                foreach (['customer_ledger', 'customer_sessions', 'customer_devices'] as $t) {
                    try { DB::table($t)->whereIn('customer_id', $customerIds)->delete(); }
                    catch (\Throwable $e) { Log::debug("Pre-clean {$t}: " . $e->getMessage()); }
                }
            }

            $employeeIds = DB::table('employees')->where('tenant_id', $id)->pluck('id');
            if ($employeeIds->isNotEmpty()) {
                foreach (['employee_education', 'employee_emergency_contacts', 'employee_experience'] as $t) {
                    try { DB::table($t)->whereIn('employee_id', $employeeIds)->delete(); }
                    catch (\Throwable $e) { Log::debug("Pre-clean {$t}: " . $e->getMessage()); }
                }
            }

            $subIds = DB::table('subscriptions')->where('tenant_id', $id)->pluck('id');
            if ($subIds->isNotEmpty()) {
                try { DB::table('subscription_invoices')->whereIn('subscription_id', $subIds)->delete(); }
                catch (\Throwable $e) { Log::debug("Pre-clean subscription_invoices: " . $e->getMessage()); }
            }

            $userIds = DB::table('users')->where('tenant_id', $id)->pluck('id');
            if ($userIds->isNotEmpty()) {
                try { DB::table('user_roles')->whereIn('user_id', $userIds)->delete(); }
                catch (\Throwable $e) { Log::debug("Pre-clean user_roles: " . $e->getMessage()); }
            }

            // ── Step 2: ordered delete from known tenant-scoped tables ──
            $processed = [];
            foreach ($orderedTenantTables as $table) {
                $processed[$table] = true;
                try {
                    if (\Schema::hasColumn($table, 'tenant_id')) {
                        DB::table($table)->where('tenant_id', $id)->delete();
                    }
                } catch (\Throwable $e) {
                    Log::debug("Cascade delete {$table}: " . $e->getMessage());
                }
            }

            // ── Step 3: auto-discover any OTHER table with `tenant_id` and clean ──
            // This future-proofs the cascade: any new tenant-scoped table is
            // cleaned automatically without needing controller updates.
            //
            // GLOBAL-SHARED tables MUST be skipped here. These tables can hold
            // either tenant rows (tenant_id = <uuid>) or global Super-Admin
            // rows (tenant_id = NULL), and the global rows are shared across
            // all tenants. They are deleted separately below with an explicit
            // `tenant_id IS NOT NULL` guard so the global row never disappears.
            $globalSharedSkip = [
                'sms_settings' => true, // Global GreenWeb SMS gateway lives here
            ];
            try {
                $driver = DB::getDriverName();
                $autoTables = [];
                if ($driver === 'mysql' || $driver === 'mariadb') {
                    $rows = DB::select("SELECT TABLE_NAME AS t FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'tenant_id'");
                    foreach ($rows as $r) { $autoTables[] = $r->t; }
                } elseif ($driver === 'pgsql') {
                    $rows = DB::select("SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenant_id'");
                    foreach ($rows as $r) { $autoTables[] = $r->t; }
                }
                foreach ($autoTables as $table) {
                    if ($table === 'tenants' || isset($processed[$table]) || isset($globalSharedSkip[$table])) continue;
                    try {
                        DB::table($table)->where('tenant_id', $id)->delete();
                    } catch (\Throwable $e) {
                        Log::debug("Auto cascade {$table}: " . $e->getMessage());
                    }
                }
            } catch (\Throwable $e) {
                Log::debug("Auto-discover tenant_id tables failed: " . $e->getMessage());
            }

            // ── Step 3b: SMS settings — delete ONLY tenant-scoped rows ──
            // Hard guard: `tenant_id IS NOT NULL` ensures the Super Admin's
            // global GreenWeb gateway row (tenant_id = NULL) is never touched.
            try {
                $deletedSmsRows = DB::table('sms_settings')
                    ->where('tenant_id', $id)
                    ->whereNotNull('tenant_id')
                    ->delete();
                Log::info("Tenant SMS settings cleanup: deleted {$deletedSmsRows} row(s) for tenant {$id} — global row preserved.");
            } catch (\Throwable $e) {
                Log::debug("Tenant SMS settings cleanup: " . $e->getMessage());
            }


            // ── Step 4: delete users belonging to tenant ──
            try { DB::table('users')->where('tenant_id', $id)->delete(); }
            catch (\Throwable $e) { Log::debug("Delete tenant users: " . $e->getMessage()); }

            // ── Step 5: finally remove the tenant row ──
            $tenant->delete();

            $this->assertGlobalSmsSettingsPreservedAfterTenantDelete($smsGatewayGuard);

            $this->logTenantDeletion($request, $tenantSnapshot, $id);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Tenant delete failed: " . $e->getMessage());
            return response()->json(['error' => 'Failed to delete tenant: ' . $e->getMessage()], 500);
        }

        return response()->json(['success' => true]);
    }

    protected function preserveGlobalSmsSettingsForTenantDelete(string $tenantId): ?array
    {
        $globalSettings = SmsSetting::withoutGlobalScopes()
            ->whereNull('tenant_id')
            ->orderByRaw("CASE WHEN api_token IS NULL OR api_token = '' THEN 1 ELSE 0 END")
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();

        if ($globalSettings && filled(trim((string) $globalSettings->api_token))) {
            return [
                'sms_settings_id' => (string) $globalSettings->id,
                'api_token' => (string) $globalSettings->api_token,
                'sender_id' => $globalSettings->sender_id,
                'source' => 'existing_global',
            ];
        }

        $legacyTenantSettings = SmsSetting::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('api_token')
            ->where('api_token', '!=', '')
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();

        if (!$legacyTenantSettings) {
            return null;
        }

        $usedExistingGlobalRow = $globalSettings && $globalSettings->id !== $legacyTenantSettings->id;

        SmsSetting::withoutEvents(function () use (&$globalSettings, $legacyTenantSettings) {
            $payload = [
                'api_token' => $legacyTenantSettings->api_token,
                'sender_id' => $legacyTenantSettings->sender_id,
                'admin_cost_rate' => $legacyTenantSettings->admin_cost_rate,
                'sms_on_bill_generate' => $legacyTenantSettings->sms_on_bill_generate,
                'sms_on_payment' => $legacyTenantSettings->sms_on_payment,
                'sms_on_registration' => $legacyTenantSettings->sms_on_registration,
                'sms_on_suspension' => $legacyTenantSettings->sms_on_suspension,
                'sms_on_reminder' => $legacyTenantSettings->sms_on_reminder,
                'sms_on_new_customer_bill' => $legacyTenantSettings->sms_on_new_customer_bill,
                'whatsapp_enabled' => $legacyTenantSettings->whatsapp_enabled,
                'whatsapp_token' => $legacyTenantSettings->whatsapp_token,
                'whatsapp_phone_id' => $legacyTenantSettings->whatsapp_phone_id,
            ];

            if ($globalSettings) {
                $globalSettings->forceFill($payload);
                $globalSettings->tenant_id = null;
                $globalSettings->updated_at = now();
                $globalSettings->save();
            } else {
                $legacyTenantSettings->forceFill($payload);
                $legacyTenantSettings->tenant_id = null;
                $legacyTenantSettings->updated_at = now();
                $legacyTenantSettings->save();
                $globalSettings = $legacyTenantSettings;
            }
        });

        Log::info('Restored global SMS settings from tenant row before tenant deletion', [
            'tenant_id' => $tenantId,
            'global_sms_settings_id' => $globalSettings?->id,
            'legacy_sms_settings_id' => $legacyTenantSettings->id,
            'sms_settings_id' => $legacyTenantSettings->id,
            'used_existing_global_row' => $usedExistingGlobalRow,
        ]);

        return [
            'sms_settings_id' => (string) ($globalSettings?->id ?? $legacyTenantSettings->id),
            'api_token' => (string) $legacyTenantSettings->api_token,
            'sender_id' => $legacyTenantSettings->sender_id,
            'source' => $usedExistingGlobalRow ? 'restored_global' : 'promoted_legacy_tenant_row',
        ];
    }

    protected function assertGlobalSmsSettingsPreservedAfterTenantDelete(?array $guard): void
    {
        $expectedToken = trim((string) ($guard['api_token'] ?? ''));
        if ($expectedToken === '') {
            return;
        }

        $globalSettings = SmsSetting::withoutGlobalScopes()
            ->whereNull('tenant_id')
            ->where('api_token', $expectedToken)
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();

        if (!$globalSettings) {
            throw new \RuntimeException('Global GreenWeb SMS gateway preservation check failed after tenant deletion.');
        }

        $expectedSenderId = $guard['sender_id'] ?? null;
        if ($expectedSenderId !== null && $globalSettings->sender_id !== $expectedSenderId) {
            throw new \RuntimeException('Global GreenWeb SMS gateway sender_id changed during tenant deletion.');
        }
    }

    protected function logTenantDeletion(Request $request, array $tenantSnapshot, string $tenantId): void
    {
        try {
            $tenantName = $tenantSnapshot['name'] ?? 'Unknown tenant';
            $tenantSubdomain = $tenantSnapshot['subdomain'] ?? null;

            $this->logSuperAdminAction(
                $request,
                'delete',
                'tenants',
                $tenantId,
                $tenantSnapshot,
                null,
                $tenantSubdomain
                    ? "Deleted tenant {$tenantName} ({$tenantSubdomain})"
                    : "Deleted tenant {$tenantName}",
                null,
                [
                    'tenant_name' => $tenantSnapshot['name'] ?? null,
                    'tenant_subdomain' => $tenantSnapshot['subdomain'] ?? null,
                    'tenant_email' => $tenantSnapshot['email'] ?? null,
                ],
            );
        } catch (\Throwable $e) {
            Log::warning('Tenant deletion log failed: ' . $e->getMessage());
        }
    }

    protected function getSuperAdminActor(Request $request): array
    {
        $admin = $request->attributes->get('super_admin')
            ?? $request->get('super_admin')
            ?? $request->attributes->get('admin_user')
            ?? $request->get('admin_user');

        return [
            'id' => (string) ($admin->id ?? '00000000-0000-0000-0000-000000000000'),
            'name' => $admin->name ?? $admin->full_name ?? $admin->email ?? 'Super Admin',
        ];
    }

    protected function logSuperAdminAction(
        Request $request,
        string $action,
        string $table,
        string $recordId,
        ?array $oldData = null,
        ?array $newData = null,
        ?string $description = null,
        ?string $tenantId = null,
        ?array $metadata = null
    ): void {
        try {
            $actor = $this->getSuperAdminActor($request);
            $module = EnhancedAuditLogger::guessModulePublic($table);

            EnhancedAuditLogger::log(
                $action,
                $table,
                $recordId,
                $oldData,
                $newData,
                $module,
                $actor['id'],
                $actor['name'],
                $tenantId,
                $request
            );

            ActivityLogger::log(
                $action,
                $module,
                $description ?? ucfirst($action) . " {$table}",
                $actor['id'],
                $tenantId,
                array_merge([
                    'table' => $table,
                    'record_id' => $recordId,
                ], $metadata ?? []),
                $request
            );
        } catch (\Throwable $e) {
            Log::warning('Super admin action log failed: ' . $e->getMessage());
        }
    }

    // ══════════════════════════════════════════
    // PLAN MANAGEMENT
    // ══════════════════════════════════════════
    public function plans()
    {
        $plans = SaasPlan::withCount('subscriptions')
            ->with('modules')
            ->orderBy('sort_order')
            ->get();

        // Attach module slugs for each plan
        $plans->each(function ($plan) {
            $plan->module_slugs = $plan->modules->pluck('slug')->toArray();
        });

        return response()->json($plans);
    }

    public function createPlan(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:100|unique:saas_plans,slug',
            'price_monthly' => 'required|numeric|min:0',
            'price_yearly' => 'nullable|numeric|min:0',
            'max_customers' => 'required|integer|min:1',
            'max_users' => 'required|integer|min:1',
        ]);

        $plan = SaasPlan::create($request->except('modules'));

        // Sync plan modules
        if ($request->has('modules') && is_array($request->modules)) {
            PlanModuleService::syncPlanModules($plan->id, $request->modules);
        }

        return response()->json($plan->load('modules'), 201);
    }

    public function updatePlan(Request $request, string $id)
    {
        $plan = SaasPlan::findOrFail($id);
        $plan->update($request->except('modules'));

        // Sync plan modules if provided
        if ($request->has('modules') && is_array($request->modules)) {
            PlanModuleService::syncPlanModules($plan->id, $request->modules);
        }

        return response()->json($plan->load('modules'));
    }

    public function deletePlan(string $id)
    {
        $plan = SaasPlan::findOrFail($id);
        if ($plan->subscriptions()->where('status', 'active')->exists()) {
            return response()->json(['error' => 'Cannot delete plan with active subscriptions'], 422);
        }
        $plan->delete();
        return response()->json(['success' => true]);
    }

    // ══════════════════════════════════════════
    // SUBSCRIPTION MANAGEMENT
    // ══════════════════════════════════════════
    public function subscriptions(Request $request)
    {
        $query = Subscription::with('tenant', 'plan');

        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->tenant_id) {
            $query->where('tenant_id', $request->tenant_id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function assignSubscription(Request $request)
    {
        $request->validate([
            'tenant_id' => 'required|uuid|exists:tenants,id',
            'plan_id' => 'required|uuid|exists:saas_plans,id',
            'billing_cycle' => 'required|in:monthly,yearly',
            'start_date' => 'nullable|date',
        ]);

        // Default start_date to today if not provided
        $startDate = $request->start_date ?: now()->toDateString();

        $plan = SaasPlan::findOrFail($request->plan_id);

        // Expire old subscriptions
        Subscription::where('tenant_id', $request->tenant_id)
            ->whereIn('status', ['active', 'pending'])
            ->update(['status' => 'expired']);

        $endDate = $request->billing_cycle === 'yearly'
            ? date('Y-m-d', strtotime($startDate . ' +1 year'))
            : date('Y-m-d', strtotime($startDate . ' +1 month'));

        $amount = $request->billing_cycle === 'yearly'
            ? $plan->price_yearly
            : $plan->price_monthly;

        $sub = Subscription::create([
            'tenant_id' => $request->tenant_id,
            'plan_id' => $plan->id,
            'billing_cycle' => $request->billing_cycle,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'status' => 'expired',
            'amount' => $amount,
        ]);

        // Update tenant plan, plan_id, plan_expire_date & status
        Tenant::where('id', $request->tenant_id)->update([
            'plan' => $plan->slug,
            'plan_id' => $plan->id,
            'plan_expire_date' => $endDate,
            'status' => 'suspended',
        ]);

        // Auto-create subscription invoice
        $this->createSubscriptionInvoice($sub, $plan, $amount);

        return response()->json($sub->load('tenant', 'plan'), 201);
    }

    /**
     * Helper: Create a subscription invoice for a new subscription.
     */
    private function createSubscriptionInvoice(Subscription $sub, SaasPlan $plan, $amount): void
    {
        try {
            SubscriptionInvoice::create([
                'tenant_id' => $sub->tenant_id,
                'plan_id' => $plan->id,
                'subscription_id' => $sub->id,
                'amount' => $amount,
                'tax_amount' => 0,
                'total_amount' => $amount,
                'billing_cycle' => $sub->billing_cycle,
                'due_date' => $sub->start_date,
                'status' => 'pending',
                'notes' => "Invoice for {$plan->name} ({$sub->billing_cycle}) subscription",
            ]);
        } catch (\Exception $e) {
            Log::warning('Auto subscription invoice creation failed: ' . $e->getMessage());
        }
    }

    public function updateSubscription(Request $request, string $id)
    {
        $sub = Subscription::findOrFail($id);

        $request->validate([
            'status' => 'sometimes|in:active,expired,cancelled',
            'billing_cycle' => 'sometimes|in:monthly,yearly',
            'end_date' => 'sometimes|date',
            'plan_id' => 'sometimes|uuid|exists:saas_plans,id',
        ]);

        if ($request->has('plan_id') && $request->plan_id !== $sub->plan_id) {
            $plan = SaasPlan::findOrFail($request->plan_id);
            $amount = ($request->billing_cycle ?? $sub->billing_cycle) === 'yearly'
                ? $plan->price_yearly : $plan->price_monthly;
            $sub->plan_id = $plan->id;
            $sub->amount = $amount;
        }

        if ($request->has('status')) $sub->status = $request->status;
        if ($request->has('billing_cycle')) $sub->billing_cycle = $request->billing_cycle;
        if ($request->has('end_date')) $sub->end_date = $request->end_date;

        $sub->save();

        return response()->json($sub->load('tenant', 'plan'));
    }

    public function deleteSubscription(string $id)
    {
        $sub = Subscription::find($id);
        if (!$sub) {
            // Try raw delete in case model has issues
            $deleted = DB::table('subscriptions')->where('id', $id)->delete();
            if ($deleted) {
                DB::table('subscription_invoices')->where('subscription_id', $id)->delete();
                return response()->json(['success' => true, 'message' => 'Subscription deleted']);
            }
            return response()->json(['error' => 'Subscription not found'], 404);
        }

        DB::beginTransaction();
        try {
            // Delete related invoices first
            DB::table('subscription_invoices')->where('subscription_id', $id)->delete();
            $sub->delete();
            DB::commit();
            return response()->json(['success' => true, 'message' => 'Subscription deleted']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Delete failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Mark a subscription invoice as paid → auto-activate tenant + subscription
     */
    public function markInvoicePaid(Request $request, string $id)
    {
        $invoice = SubscriptionInvoice::find($id);
        if (!$invoice) {
            return response()->json(['error' => 'Invoice not found'], 404);
        }

        if ($invoice->status === 'paid') {
            return response()->json(['message' => 'Invoice is already paid', 'invoice' => $invoice]);
        }

        try {
            SubscriptionActivationService::activateOnInvoicePaid($id);

            $this->logSuperAdminAction(
                $request,
                'payment',
                'subscription_invoices',
                $id,
                ['status' => $invoice->status],
                ['status' => 'paid'],
                "Marked invoice as paid for tenant {$invoice->tenant_id}"
            );

            return response()->json([
                'success' => true,
                'message' => 'Invoice paid, tenant and subscription activated',
                'invoice' => $invoice->fresh(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Activation failed: ' . $e->getMessage()], 500);
        }
    }


    // ══════════════════════════════════════════
    // DOMAIN MANAGEMENT (Super Admin)
    // ══════════════════════════════════════════
    public function allDomains()
    {
        return response()->json(
            Domain::with('tenant')->orderBy('created_at', 'desc')->get()
        );
    }

    public function assignDomain(Request $request)
    {
        $request->validate([
            'tenant_id' => 'required|uuid|exists:tenants,id',
            'domain' => 'required|string|max:255|unique:domains,domain',
        ]);

        $domain = Domain::create([
            'tenant_id' => $request->tenant_id,
            'domain' => strtolower($request->domain),
            'is_primary' => !Domain::where('tenant_id', $request->tenant_id)->exists(),
            'is_verified' => true, // Super admin bypasses verification
        ]);

        return response()->json($domain, 201);
    }

    public function removeDomain(string $id)
    {
        $domain = Domain::findOrFail($id);
        TenantResolver::flushCache($domain->domain);
        $domain->delete();
        return response()->json(['success' => true]);
    }

    // ══════════════════════════════════════════
    // MODULE MANAGEMENT (Super Admin)
    // ══════════════════════════════════════════
    public function allModules()
    {
        return response()->json(
            Module::orderBy('sort_order')->get()
        );
    }

    public function updateModule(Request $request, string $id)
    {
        $module = Module::findOrFail($id);
        $module->update($request->only(['name', 'description', 'icon', 'is_active', 'sort_order']));
        return response()->json($module);
    }

    /**
     * Get allowed modules for a specific tenant.
     */
    public function tenantModules(string $tenantId)
    {
        $allowed = PlanModuleService::getAllowedModules($tenantId);
        $allModules = Module::where('is_active', true)->orderBy('sort_order')->get();

        $result = $allModules->map(function ($mod) use ($allowed) {
            return [
                'id'       => $mod->id,
                'name'     => $mod->name,
                'slug'     => $mod->slug,
                'is_core'  => $mod->is_core,
                'allowed'  => in_array($mod->slug, $allowed),
            ];
        });

        return response()->json($result);
    }

    // ══════════════════════════════════════════
    // SMS MANAGEMENT (Super Admin)
    // ══════════════════════════════════════════

    /**
     * Get global SMS settings.
     */
    public function smsSettings()
    {
        $settings = SmsSetting::withoutGlobalScopes()
            ->whereNull('tenant_id')
            ->whereNotNull('api_token')
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first()
            ?? SmsSetting::withoutGlobalScopes()
                ->orderByRaw('CASE WHEN tenant_id IS NULL THEN 0 ELSE 1 END')
                ->orderByRaw('CASE WHEN api_token IS NULL OR api_token = \'\' THEN 1 ELSE 0 END')
                ->orderByDesc('updated_at')
                ->orderByDesc('created_at')
                ->first();

        return response()->json($settings);
    }

    /**
     * Update global SMS settings.
     */
    public function updateSmsSettings(Request $request)
    {
        $payload = $request->only([
            'api_token', 'sender_id', 'admin_cost_rate',
            'sms_on_bill_generate', 'sms_on_payment', 'sms_on_registration',
            'sms_on_suspension', 'sms_on_reminder', 'sms_on_new_customer_bill',
            'whatsapp_enabled', 'whatsapp_token', 'whatsapp_phone_id',
        ]);

        $settings = SmsSetting::withoutGlobalScopes()
            ->whereNull('tenant_id')
            ->orderByRaw("CASE WHEN api_token IS NULL OR api_token = '' THEN 1 ELSE 0 END")
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();
        $oldSettings = $settings?->toArray();

        // Save with model events disabled so BelongsToTenant's `creating`
        // hook cannot auto-fill tenant_id when a Super Admin somehow has
        // a lingering tenant context. Global SMS row MUST stay tenant_id = NULL.
        SmsSetting::withoutEvents(function () use (&$settings, $payload) {
            if (!$settings) {
                $settings = new SmsSetting();
                $settings->forceFill(array_merge($payload, ['tenant_id' => null]));
                $settings->save();
            } else {
                $settings->forceFill($payload);
                $settings->tenant_id = null;
                $settings->updated_at = now();
                $settings->save();
            }
        });

        // Hard guarantee: even if some upstream change set tenant_id, fix it now.
        if ($settings && $settings->tenant_id !== null) {
            DB::table('sms_settings')->where('id', $settings->id)->update(['tenant_id' => null]);
            $settings = $settings->fresh();
        }


        $freshSettings = $settings->fresh();

        $this->logSuperAdminAction(
            $request,
            $oldSettings ? 'edit' : 'create',
            'sms_settings',
            (string) $freshSettings->id,
            $oldSettings,
            $freshSettings->toArray(),
            $oldSettings ? 'Updated global SMS settings' : 'Created global SMS settings'
        );

        return response()->json($freshSettings);
    }

    /**
     * Where is the runtime SMS gateway being resolved from?
     * Used by the Super Admin SMS Management UI badge.
     */
    public function smsResolveSource(SmsService $sms)
    {
        return response()->json($sms->resolveSettingsSource());
    }

    /**
     * Manual trigger for the global GreenWeb auto-heal flow.
     * Promotes any legacy tenant-bound row to global if no global exists.
     * Audited via ActivityLogger inside the service.
     */
    public function healSmsGateway(Request $request, SmsService $sms)
    {
        $actor = $this->getSuperAdminActor($request);
        $result = $sms->autoHealGlobalGateway($actor['id'], $actor['name']);

        $this->logSuperAdminAction(
            $request,
            'heal',
            'sms_settings',
            (string) ($result['sms_settings_id'] ?? '00000000-0000-0000-0000-000000000000'),
            null,
            $result,
            'Manually triggered SMS gateway auto-heal: ' . ($result['message'] ?? 'no-op'),
            null,
            $result,
        );

        return response()->json($result);
    }

    /**
     * Check GreenWeb SMS API balance (for super admin).
     */
    public function smsBalance()
    {
        try {
            $settings = SmsSetting::withoutGlobalScopes()
                ->whereNull('tenant_id')
                ->orderByDesc('updated_at')
                ->orderByDesc('created_at')
                ->first()
                ?? SmsSetting::withoutGlobalScopes()
                    ->orderByDesc('updated_at')
                    ->orderByDesc('created_at')
                    ->first();
            $token = $settings?->api_token;

            if (!$token) {
                $token = config('services.greenweb.token', '');
            }

            if (!$token) {
                return response()->json([
                    'error' => 'SMS API token not configured.',
                ], 400);
            }

            // Fetch balance + expiry + rate
            $balanceUrl = "http://api.greenweb.com.bd/g_api.php?token={$token}&balance&expiry&rate&json";
            $response = \Illuminate\Support\Facades\Http::timeout(15)->get($balanceUrl);
            $rawText = $response->body();

            $balanceData = null;
            try {
                $balanceData = json_decode($rawText, true);
            } catch (\Exception $e) {
                // not JSON
            }

            if (is_array($balanceData)) {
                $items = isset($balanceData[0]) ? $balanceData : [$balanceData];
                $items = array_map(function ($item) {
                    unset($item['token']);
                    return $item;
                }, $items);
            } else {
                $items = [['balance' => trim($rawText)]];
            }

            // Fetch total sent via tokensms endpoint
            $totalSent = 0;
            try {
                $statsUrl = "http://api.greenweb.com.bd/g_api.php?token={$token}&tokensms";
                $statsRes = \Illuminate\Support\Facades\Http::timeout(15)->get($statsUrl);
                $statsText = $statsRes->body();
                $parsed = intval(trim($statsText));
                if ($parsed > 0) {
                    $totalSent = $parsed;
                } else {
                    $decoded = json_decode($statsText, true);
                    if (is_array($decoded)) {
                        $totalSent = $decoded['total_sms'] ?? $decoded['tokensms'] ?? $decoded['sent'] ?? $decoded['count'] ?? 0;
                    }
                }
            } catch (\Exception $e) {
                // stats fetch failed
            }

            return response()->json([
                'balance'    => $items,
                'total_sent' => $totalSent,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'balance'    => [],
                'total_sent' => 0,
                'error'      => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all tenant SMS wallets.
     */
    public function smsWallets()
    {
        $tenants = Tenant::select('id', 'name', 'subdomain', 'status')->get();

        $wallets = SmsWallet::all()->keyBy('tenant_id');

        $result = $tenants->map(function ($tenant) use ($wallets) {
            $wallet = $wallets->get($tenant->id);
            return [
                'tenant_id'  => $tenant->id,
                'tenant_name' => $tenant->name,
                'subdomain'  => $tenant->subdomain,
                'status'     => $tenant->status,
                'balance'    => $wallet ? $wallet->balance : 0,
                'wallet_id'  => $wallet ? $wallet->id : null,
            ];
        });

        return response()->json($result);
    }

    /**
     * Recharge SMS balance for a tenant.
     */
    public function rechargeSms(Request $request)
    {
        $request->validate([
            'tenant_id'   => 'required|uuid|exists:tenants,id',
            'amount'      => 'required|integer|min:1',
            'description' => 'nullable|string|max:500',
        ]);

        $wallet = SmsWallet::firstOrCreate(
            ['tenant_id' => $request->tenant_id],
            ['balance' => 0]
        );

        $adminId = $request->get('super_admin')?->id ?? 'super_admin';

        $wallet->recharge(
            $request->amount,
            $request->description ?? 'SMS Recharge by Super Admin',
            $adminId
        );

        return response()->json([
            'success'     => true,
            'new_balance' => $wallet->balance,
            'tenant_id'   => $request->tenant_id,
        ]);
    }

    /**
     * Get SMS transaction history for a tenant.
     */
    public function smsTransactions(Request $request)
    {
        $query = SmsTransaction::orderBy('created_at', 'desc');

        if ($request->tenant_id) {
            $query->where('tenant_id', $request->tenant_id);
        }

        return response()->json($query->limit(200)->get());
    }

    // ══════════════════════════════════════════
    // SMTP MANAGEMENT (Super Admin)
    // ══════════════════════════════════════════

    /**
     * Get SMTP settings.
     */
    public function smtpSettings()
    {
        $smtp = SmtpSetting::query()
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();
        return response()->json($smtp);
    }

    /**
     * Update or create SMTP settings.
     */
    public function updateSmtpSettings(Request $request)
    {
        $request->validate([
            'host'       => 'required|string|max:255',
            'port'       => 'required|integer|min:1|max:65535',
            'username'   => 'required|string|max:255',
            'password'   => 'nullable|string|max:2000',
            'from_email' => 'required|email|max:255',
            'from_name'  => 'required|string|max:255',
        ]);

        $encryption = strtolower((string) $request->input('encryption', 'tls'));
        $data = [
            'host' => trim((string) $request->input('host')),
            'port' => (int) $request->input('port', 587),
            'username' => trim((string) $request->input('username')),
            'encryption' => in_array($encryption, ['tls', 'ssl', 'none'], true) ? $encryption : 'tls',
            'from_email' => trim((string) $request->input('from_email')),
            'from_name' => trim((string) $request->input('from_name')),
            'status' => strtolower((string) $request->input('status', 'active')) === 'inactive' ? 'inactive' : 'active',
        ];

        if ($request->filled('password')) {
            $data['password'] = (string) $request->input('password');
        }

        try {
            $smtp = SmtpSetting::query()
                ->orderByDesc('updated_at')
                ->orderByDesc('created_at')
                ->first();

            if ($smtp) {
                $smtp->update($data);
            } else {
                $data['password'] = $data['password'] ?? '';
                $smtp = SmtpSetting::create($data);
            }

            return response()->json($smtp->fresh());
        } catch (\Throwable $e) {
            Log::error('Super admin SMTP save failed', [
                'message' => $e->getMessage(),
                'host' => $data['host'] ?? null,
                'port' => $data['port'] ?? null,
                'username' => $data['username'] ?? null,
            ]);

            return response()->json([
                'error' => 'Failed to save SMTP settings: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Test SMTP connection.
     */
    public function testSmtp(Request $request)
    {
        $request->validate(['to' => 'required|email']);

        $emailService = new TenantEmailService();
        $result = $emailService->send(
            $request->to,
            'Smart ISP — SMTP Test Email',
            '<div style="font-family:Arial,sans-serif;padding:20px;"><h2>SMTP Test Successful ✅</h2><p>Your SMTP configuration is working correctly.</p><p style="color:#666;font-size:12px;">Sent at: ' . now()->toDateTimeString() . '</p></div>'
        );

        return response()->json($result);
    }

    /**
     * Create additional user for a tenant (multi-admin support).
     */
    public function createTenantUser(Request $request, string $tenantId)
    {
        $request->validate([
            'full_name' => 'required|string|max:255',
            'email'     => 'required|email',
            'password'  => 'required|string|min:6',
            'role'      => 'required|in:super_admin,admin,manager,staff,operator,technician,accountant',
        ]);

        $tenant = Tenant::findOrFail($tenantId);

        // Check for duplicate email within tenant
        $exists = User::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('email', $request->email)
            ->exists();

        if ($exists) {
            return response()->json(['error' => 'Email already exists for this tenant'], 422);
        }

        $user = User::create([
            'tenant_id'            => $tenantId,
            'full_name'            => $request->full_name,
            'email'                => $request->email,
            'username'             => strtolower(Str::slug($request->full_name, '_')),
            'password_hash'        => Hash::make($request->password),
            'status'               => 'active',
            'must_change_password' => true,
        ]);

        $customRole = CustomRole::where('db_role', $request->role)->first();
        UserRole::create([
            'user_id'        => $user->id,
            'role'           => $request->role,
            'custom_role_id' => $customRole?->id,
        ]);

        // Send credentials email
        try {
            $loginUrl = "https://{$tenant->subdomain}.smartispapp.com/admin/login";
            $emailService = new TenantEmailService();
            $emailService->sendTenantCredentials(
                $tenant->toArray(),
                $request->email,
                $request->full_name,
                $request->password,
                $loginUrl
            );
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('User credentials email failed: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'user'    => $user->fresh(),
        ], 201);
    }

    // ══════════════════════════════════════════
    // PLAN CHECK — suspend/warn expired tenants
    // ══════════════════════════════════════════
    public function planCheck()
    {
        $now = now()->toDateString();
        $checked = 0;
        $suspended = 0;
        $warned = 0;

        $tenants = Tenant::where('status', 'active')->get();

        foreach ($tenants as $tenant) {
            $checked++;
            $activeSub = Subscription::where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->where('end_date', '>=', $now)
                ->first();

            if (!$activeSub) {
                // Check if there's any subscription that recently expired
                $expiredSub = Subscription::where('tenant_id', $tenant->id)
                    ->where('status', 'active')
                    ->where('end_date', '<', $now)
                    ->first();

                if ($expiredSub) {
                    $expiredSub->update(['status' => 'expired']);
                    $tenant->update(['status' => 'suspended']);
                    $suspended++;
                }
            } else {
                // Warn if expiring within 7 days
                $daysLeft = now()->diffInDays($activeSub->end_date, false);
                if ($daysLeft <= 7 && $daysLeft > 0) {
                    $warned++;
                }
            }
        }

        return response()->json([
            'checked' => $checked,
            'suspended' => $suspended,
            'warned' => $warned,
        ]);
    }
}
