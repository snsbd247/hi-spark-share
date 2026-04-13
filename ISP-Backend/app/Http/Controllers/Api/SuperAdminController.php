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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
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
                    'status' => 'active',
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
                        'status' => 'active',
                        'amount' => $amount,
                    ]);

                    $tenant->update(['plan' => $plan->slug]);
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

        return response()->json([
            'success' => true,
            'tenant' => $tenant,
            'id' => $tenant->id,
        ], 201);
    }

    public function updateTenant(Request $request, string $id)
    {
        $tenant = Tenant::findOrFail($id);

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

        return response()->json($tenant->load('domains'));
    }

    public function suspendTenant(string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $tenant->update(['status' => 'suspended']);

        // Suspend active subscriptions
        Subscription::where('tenant_id', $id)
            ->where('status', 'active')
            ->update(['status' => 'suspended']);

        TenantResolver::flushTenantCache($tenant);

        return response()->json(['success' => true, 'message' => 'Tenant suspended']);
    }

    public function activateTenant(string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $tenant->update(['status' => 'active']);

        TenantResolver::flushTenantCache($tenant);

        return response()->json(['success' => true, 'message' => 'Tenant activated']);
    }

    public function deleteTenant(string $id)
    {
        $tenant = Tenant::findOrFail($id);
        TenantResolver::flushTenantCache($tenant);

        // Cascade delete all dependent records
        $childTables = [
            'customer_ledger' => 'customer_id',
            'customer_sessions' => 'customer_id',
            'customer_devices', 'customer_bandwidth_usages',
            'customer_reseller_migrations',
            'employee_education' => 'employee_id',
            'employee_emergency_contacts' => 'employee_id',
            'employee_experience' => 'employee_id',
            'employee_provident_fund', 'employee_salary_structure', 'employee_savings_fund',
            'core_connections', 'fiber_cores', 'fiber_cables', 'fiber_splitter_outputs',
            'fiber_splitters', 'fiber_pon_ports', 'fiber_olts', 'fiber_onus',
            'attendance', 'salary_sheets', 'loans',
            'online_sessions', 'login_histories', 'impersonations',
            'reminder_logs', 'ticket_replies', 'support_tickets',
            'sms_logs', 'sms_transactions', 'sms_wallets', 'sms_templates', 'sms_settings',
            'merchant_payments', 'supplier_payments',
            'purchase_items', 'purchases', 'sale_items', 'sales',
            'inventory_logs', 'product_serials',
            'reseller_commissions', 'reseller_package_commissions',
            'reseller_wallet_transactions', 'reseller_sessions', 'reseller_packages',
            'network_links', 'network_nodes',
            'notifications',
            'bills', 'payments', 'transactions',
            'customers', 'reseller_zones', 'resellers', 'zones',
            'employees', 'designations',
            'expenses', 'expense_heads', 'income_heads', 'other_heads',
            'accounts', 'system_settings',
            'packages', 'ip_pools',
            'mikrotik_routers', 'olts', 'onus',
            'categories', 'products', 'suppliers',
            'payment_gateways',
            'activity_logs', 'audit_logs', 'admin_login_logs', 'admin_sessions',
            'role_permissions', 'user_roles', 'custom_roles',
            'daily_reports',
            'tenant_company_info',
            'subscription_invoices', 'subscriptions',
            'demo_requests',
            'domains', 'profiles',
        ];

        DB::beginTransaction();
        try {
            // First: delete subscription_invoices via subscription_id FK
            $subIds = DB::table('subscriptions')->where('tenant_id', $id)->pluck('id');
            if ($subIds->isNotEmpty()) {
                DB::table('subscription_invoices')->whereIn('subscription_id', $subIds)->delete();
            }
            // Also delete any subscription_invoices directly by tenant_id
            DB::table('subscription_invoices')->where('tenant_id', $id)->delete();
            DB::table('subscriptions')->where('tenant_id', $id)->delete();

            // Delete child records from tables that have tenant_id
            foreach ($childTables as $key => $value) {
                $table = is_int($key) ? $value : $key;
                if (in_array($table, ['subscriptions', 'subscription_invoices'])) continue;
                try {
                    DB::table($table)->where('tenant_id', $id)->delete();
                } catch (\Exception $e) {
                    Log::debug("Cascade delete {$table}: " . $e->getMessage());
                }
            }

            // Delete customer_ledger and customer_sessions via customers
            $customerIds = DB::table('customers')->where('tenant_id', $id)->pluck('id');
            if ($customerIds->isNotEmpty()) {
                DB::table('customer_ledger')->whereIn('customer_id', $customerIds)->delete();
                DB::table('customer_sessions')->whereIn('customer_id', $customerIds)->delete();
            }

            // Delete employee sub-records via employees
            $employeeIds = DB::table('employees')->where('tenant_id', $id)->pluck('id');
            if ($employeeIds->isNotEmpty()) {
                DB::table('employee_education')->whereIn('employee_id', $employeeIds)->delete();
                DB::table('employee_emergency_contacts')->whereIn('employee_id', $employeeIds)->delete();
                DB::table('employee_experience')->whereIn('employee_id', $employeeIds)->delete();
            }

            // Delete user_roles via users
            $userIds = DB::table('users')->where('tenant_id', $id)->pluck('id');
            if ($userIds->isNotEmpty()) {
                DB::table('user_roles')->whereIn('user_id', $userIds)->delete();
                DB::table('users')->where('tenant_id', $id)->delete();
            }

            $tenant->delete();

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Tenant delete failed: " . $e->getMessage());
            return response()->json(['error' => 'Failed to delete tenant: ' . $e->getMessage()], 500);
        }

        return response()->json(['success' => true]);
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
            'start_date' => 'required|date',
        ]);

        $plan = SaasPlan::findOrFail($request->plan_id);

        // Expire old subscriptions
        Subscription::where('tenant_id', $request->tenant_id)
            ->where('status', 'active')
            ->update(['status' => 'expired']);

        $endDate = $request->billing_cycle === 'yearly'
            ? date('Y-m-d', strtotime($request->start_date . ' +1 year'))
            : date('Y-m-d', strtotime($request->start_date . ' +1 month'));

        $amount = $request->billing_cycle === 'yearly'
            ? $plan->price_yearly
            : $plan->price_monthly;

        $sub = Subscription::create([
            'tenant_id' => $request->tenant_id,
            'plan_id' => $plan->id,
            'billing_cycle' => $request->billing_cycle,
            'start_date' => $request->start_date,
            'end_date' => $endDate,
            'status' => 'active',
            'amount' => $amount,
        ]);

        // Update tenant plan & status
        Tenant::where('id', $request->tenant_id)->update([
            'plan' => $plan->slug,
            'status' => 'active',
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
        $settings = SmsSetting::first();
        return response()->json($settings);
    }

    /**
     * Update global SMS settings.
     */
    public function updateSmsSettings(Request $request)
    {
        $settings = SmsSetting::first();
        if (!$settings) {
            $settings = SmsSetting::create($request->all());
        } else {
            $settings->update($request->all());
        }
        return response()->json($settings);
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
        $smtp = SmtpSetting::first();
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
            $smtp = SmtpSetting::first();

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
