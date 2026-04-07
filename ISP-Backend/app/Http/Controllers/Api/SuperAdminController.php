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
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserRole;
use App\Models\CustomRole;
use App\Services\PlanModuleService;
use App\Services\TenantEmailService;
use App\Services\TenantResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
        $request->validate([
            'name' => 'required|string|max:255',
            'subdomain' => 'required|string|max:100|unique:tenants,subdomain|alpha_dash',
            'email' => 'required|email',
            'phone' => 'nullable|string|max:20',
            'plan_id' => 'nullable|uuid|exists:saas_plans,id',
            'admin_name' => 'required|string|max:255',
            'admin_email' => 'required|email',
            'admin_password' => 'required|string|min:6',
        ]);

        $tenant = Tenant::create([
            'name' => $request->name,
            'subdomain' => strtolower($request->subdomain),
            'email' => $request->email,
            'phone' => $request->phone,
            'status' => 'active',
            'plan' => 'basic',
        ]);

        // Create subscription if plan selected
        if ($request->plan_id) {
            $plan = SaasPlan::find($request->plan_id);
            Subscription::create([
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'billing_cycle' => 'monthly',
                'start_date' => now()->toDateString(),
                'end_date' => now()->addMonth()->toDateString(),
                'status' => 'active',
                'amount' => $plan->price_monthly,
            ]);
            $tenant->update(['plan' => $plan->slug]);
        }

        // Create tenant admin user with forced password change
        $user = User::create([
            'tenant_id' => $tenant->id,
            'full_name' => $request->admin_name,
            'email' => $request->admin_email,
            'username' => strtolower($request->subdomain) . '_admin',
            'password_hash' => Hash::make($request->admin_password),
            'status' => 'active',
            'must_change_password' => true,
        ]);

        $superAdminRole = CustomRole::where('name', 'Super Admin')->first();
        UserRole::create([
            'user_id' => $user->id,
            'role' => 'super_admin',
            'custom_role_id' => $superAdminRole?->id,
        ]);

        // Send welcome email with credentials
        try {
            $loginUrl = "https://{$tenant->subdomain}.smartispapp.com/admin/login";
            $emailService = new TenantEmailService();
            $emailService->sendTenantCredentials(
                $tenant->toArray(),
                $request->admin_email,
                $request->admin_name,
                $request->admin_password,
                $loginUrl
            );
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('Tenant welcome email failed: ' . $e->getMessage());
        }

        return response()->json($tenant->load('domains'), 201);
    }

    public function updateTenant(Request $request, string $id)
    {
        $tenant = Tenant::findOrFail($id);

        $data = $request->only(['name', 'email', 'phone', 'logo_url', 'status', 'settings']);

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
        $tenant->delete();

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

        return response()->json($sub->load('tenant', 'plan'), 201);
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
            'from_email' => 'required|email|max:255',
            'from_name'  => 'required|string|max:255',
        ]);

        $data = $request->only(['host', 'port', 'username', 'encryption', 'from_email', 'from_name', 'status']);

        // Only update password if provided
        if ($request->filled('password')) {
            $data['password'] = $request->password;
        }

        $smtp = SmtpSetting::first();
        if ($smtp) {
            $smtp->update($data);
        } else {
            $data['password'] = $request->password ?? '';
            $smtp = SmtpSetting::create($data);
        }

        return response()->json($smtp);
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
