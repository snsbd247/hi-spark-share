import { API_BASE_URL } from "@/lib/apiBaseUrl";
import { IS_LOVABLE } from "@/lib/environment";
import { supabase } from "@/integrations/supabase/client";
import { hashPassword } from "@/lib/passwordHash";
import { sessionStore } from "@/lib/sessionStore";

const BASE = () => `${API_BASE_URL}/super-admin`;

function getToken(): string {
  return sessionStore.getItem("super_admin_token") || "";
}

function headers(): Record<string, string> {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Session-Token": token,
  };
}

async function parseApiResponse(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    if (/<!doctype|<html|<body/i.test(text)) {
      return { error: "Invalid server response" };
    }
    return { message: text };
  }
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE()}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });

  const data = await parseApiResponse(res);

  if (res.status === 401) {
    sessionStore.removeItem("super_admin_token");
    sessionStore.removeItem("super_admin_user");
    window.location.href = "/super/login";
    throw new Error((data as any)?.error || "Session expired");
  }

  if (!res.ok) {
    throw new Error((data as any)?.error || (data as any)?.message || "Request failed");
  }

  return data;
}

async function invokeSuperAdminEdge<T = any>(functionName: string, options: { method?: string; body?: any } = {}): Promise<T> {
  const token = getToken();
  if (!token) {
    sessionStore.removeItem("super_admin_token");
    sessionStore.removeItem("super_admin_user");
    window.location.href = "/super/login";
    throw new Error("Session expired");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      "X-Session-Token": token,
    },
    body: options.body === undefined || (options.method || "POST") === "GET"
      ? undefined
      : JSON.stringify(options.body),
  });

  const data = await parseApiResponse(res);

  if (res.status === 401) {
    sessionStore.removeItem("super_admin_token");
    sessionStore.removeItem("super_admin_user");
    window.location.href = "/super/login";
    throw new Error((data as any)?.error || "Session expired");
  }

  if (!res.ok) {
    throw new Error((data as any)?.error || (data as any)?.message || "Request failed");
  }

  return data as T;
}

// ─── Supabase Direct Access (for Lovable preview) ─────────────────

async function sbSelect(table: string, options?: { select?: string; filters?: Record<string, any>; order?: string; foreignTable?: string }) {
  let query = (supabase.from as any)(table).select(options?.select || "*");
  if (options?.filters) {
    for (const [k, v] of Object.entries(options.filters)) {
      query = query.eq(k, v);
    }
  }
  if (options?.order) {
    query = query.order(options.order, { ascending: false });
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/** Get customer IDs for a tenant, then fetch related records from a child table */
async function sbSelectByTenantCustomers(table: string, tenantId: string, select = "*") {
  const customers = await sbSelect("customers", { filters: { tenant_id: tenantId } });
  const customerIds = customers.map((c: any) => c.id);
  if (customerIds.length === 0) return [];
  const { data, error } = await (supabase.from as any)(table).select(select).in("customer_id", customerIds);
  if (error) throw new Error(error.message);
  return data || [];
}

async function sbInsert(table: string, data: any) {
  const { data: result, error } = await (supabase.from as any)(table).insert(data).select();
  if (error) throw new Error(error.message);
  return result;
}

async function sbUpdate(table: string, id: string, data: any) {
  const { data: result, error } = await (supabase.from as any)(table).update(data).eq("id", id).select();
  if (error) throw new Error(error.message);
  return result;
}

async function sbDelete(table: string, id: string) {
  const { error } = await (supabase.from as any)(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── API Implementation ─────────────────────────────────────────

export const superAdminApi = {
  // Dashboard
  dashboard: async () => {
    if (IS_LOVABLE) {
      const [tenants, plans, subs, smsWallets] = await Promise.all([
        sbSelect("tenants"),
        sbSelect("saas_plans"),
        sbSelect("subscriptions"),
        sbSelect("sms_wallets"),
      ]);
      const activeTenants = tenants.filter((t: any) => t.status === "active").length;
      const totalRevenue = subs.reduce((s: number, sub: any) => s + Number(sub.amount || 0), 0);
      const totalSmsBalance = smsWallets.reduce((s: number, w: any) => s + Number(w.balance || 0), 0);
      return {
        total_tenants: tenants.length,
        active_tenants: activeTenants,
        total_plans: plans.length,
        total_revenue: totalRevenue,
        total_sms_balance: totalSmsBalance,
        recent_tenants: tenants.slice(0, 5),
      };
    }
    return request("/dashboard");
  },

  // Tenants
  getTenants: async (params?: Record<string, string>) => {
    if (IS_LOVABLE) {
      const [tenants, subscriptions, plans, profiles] = await Promise.all([
        sbSelect("tenants"),
        sbSelect("subscriptions"),
        sbSelect("saas_plans"),
        sbSelect("profiles", { select: "id,tenant_id" }),
      ]);
      const now = new Date().toISOString().slice(0, 10);
      const userCountsByTenant = profiles.reduce((acc: Record<string, number>, profile: any) => {
        if (!profile.tenant_id) return acc;
        acc[profile.tenant_id] = (acc[profile.tenant_id] || 0) + 1;
        return acc;
      }, {});

      const plansById = plans.reduce((acc: Record<string, any>, plan: any) => {
        acc[plan.id] = plan;
        return acc;
      }, {});

      let data = tenants.map((t: any) => {
        const activeSub = subscriptions.find((s: any) => s.tenant_id === t.id && s.status === "active" && s.end_date >= now);
        const hasActiveSubscription = Boolean(activeSub);
        const plan = activeSub ? plansById[activeSub.plan_id] ?? null : null;
        return {
          ...t,
          active_subscription: activeSub ? { ...activeSub, plan } : null,
          customer_count: hasActiveSubscription ? t.max_customers || 0 : 0,
          user_count: hasActiveSubscription ? userCountsByTenant[t.id] || 0 : 0,
        };
      });
      if (params?.search) {
        const s = params.search.toLowerCase();
        data = data.filter((t: any) =>
          t.name?.toLowerCase().includes(s) || t.subdomain?.toLowerCase().includes(s) || t.email?.toLowerCase().includes(s)
        );
      }
      if (params?.status && params.status !== "all") {
        data = data.filter((t: any) => t.status === params.status);
      }
      return data;
    }
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/tenants${qs}`);
  },
  createTenant: async (data: any) => {
    if (IS_LOVABLE) {
      const tenant = await sbInsert("tenants", {
        name: data.name,
        subdomain: data.subdomain,
        email: data.email,
        phone: data.phone,
        plan: "basic",
        status: "active",
      });
      // Auto-create default tenant admin user
      const tenantId = Array.isArray(tenant) ? tenant[0]?.id : tenant?.id;
      const tenantRecord = Array.isArray(tenant) ? tenant[0] : tenant;
      if (tenantId) {
        const defaultUserId = crypto.randomUUID();
        const defaultUsername = (data.subdomain || data.name || "admin").toLowerCase().replace(/[^a-z0-9]/g, "") + "_admin";
        const defaultPassword = "123456789";
        try {
          await sbInsert("profiles", {
            id: defaultUserId,
            full_name: data.name + " Admin",
            username: defaultUsername,
            email: data.email || null,
            mobile: data.phone || null,
            status: "active",
            must_change_password: true,
            tenant_id: tenantId,
            password_hash: "$2b$10$Fbzs7C/PSAlBsbZAOMbseubb/BxU90sgfSeRkptO4z0owyO5broEK",
          });
          await sbInsert("user_roles", { user_id: defaultUserId, role: "owner" });
        } catch (e) {
          console.warn("Auto user creation failed:", e);
        }

        // ── Send Welcome SMS ────────────────────────
        const loginUrl = `${data.subdomain}.smartispapp.com`;
        if (data.phone) {
          try {
            await supabase.functions.invoke("send-sms", {
              body: {
                to: data.phone,
                message: `Welcome to Smart ISP! Login: ${loginUrl}, User: ${defaultUsername}, Password: ${defaultPassword}. Please change your password after first login.`,
                sms_type: "registration",
              },
            });
          } catch (e) {
            console.warn("Welcome SMS failed:", e);
          }
        }

        // ── Send Welcome Email ──────────────────────
        if (data.email) {
          try {
            await supabase.functions.invoke("send-email", {
              body: {
                to: data.email,
                subject: `Welcome to Smart ISP - ${data.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">🎉 Welcome to Smart ISP!</h2>
                    <p>Dear <strong>${data.name}</strong>,</p>
                    <p>Your ISP management portal has been successfully created. Here are your login credentials:</p>
                    <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
                      <p><strong>🌐 Login URL:</strong> <a href="https://${loginUrl}">${loginUrl}</a></p>
                      <p><strong>👤 Username:</strong> ${defaultUsername}</p>
                      <p><strong>🔑 Password:</strong> ${defaultPassword}</p>
                    </div>
                    <p style="color: #dc2626; font-weight: bold;">⚠️ Please change your password after first login.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
                    <h3>🌐 Domain Setup (Optional)</h3>
                    <p>To use your own custom domain:</p>
                    <ol>
                      <li>Go to your domain provider's DNS settings</li>
                      <li>Add a CNAME record pointing to <code>${loginUrl}</code></li>
                      <li>Or add an A record pointing to your server IP</li>
                      <li>Enable Cloudflare proxy for free SSL (recommended)</li>
                    </ol>
                    <p style="color: #64748b; font-size: 12px;">— Smart ISP Team</p>
                  </div>
                `,
              },
            });
          } catch (e) {
            console.warn("Welcome email failed:", e);
          }
        }
      }
      return tenant;
    }
    return request("/tenants", { method: "POST", body: JSON.stringify(data) });
  },
  updateTenant: async (id: string, data: any) => {
    if (IS_LOVABLE) return sbUpdate("tenants", id, data);
    return request(`/tenants/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  suspendTenant: async (id: string) => {
    if (IS_LOVABLE) return sbUpdate("tenants", id, { status: "suspended" });
    return request(`/tenants/${id}/suspend`, { method: "POST" });
  },
  activateTenant: async (id: string) => {
    if (IS_LOVABLE) return sbUpdate("tenants", id, { status: "active" });
    return request(`/tenants/${id}/activate`, { method: "POST" });
  },
  deleteTenant: async (id: string) => {
    if (IS_LOVABLE) {
      // Cascade delete ALL dependent records in correct order (deepest children first)
      const childTables = [
        // Deepest children (no further dependents)
        "customer_ledger", "customer_sessions", "customer_devices",
        "customer_bandwidth_usages", "customer_reseller_migrations",
        "employee_education", "employee_emergency_contacts", "employee_experience",
        "employee_provident_fund", "employee_salary_structure", "employee_savings_fund",
        "core_connections", "fiber_cores", "fiber_cables", "fiber_splitter_outputs",
        "fiber_splitters", "fiber_pon_ports", "fiber_olts", "fiber_onus",
        "attendance", "salary_sheets", "loans",
        "online_sessions", "login_histories", "impersonations",
        "reminder_logs", "ticket_replies", "support_tickets",
        "sms_logs", "sms_transactions", "sms_wallets", "sms_templates", "sms_settings",
        "merchant_payments", "supplier_payments",
        "purchase_items", "purchases", "sale_items", "sales",
        "inventory_logs", "product_serials",
        "reseller_commissions", "reseller_package_commissions",
        "reseller_wallet_transactions", "reseller_sessions", "reseller_packages",
        "network_links", "network_nodes",
        "notifications",
        // Mid-level
        "bills", "payments", "transactions",
        "customers", "reseller_zones", "resellers", "zones",
        "employees", "designations",
        "expenses", "expense_heads", "income_heads", "other_heads",
        "accounts", "system_settings",
        "packages", "ip_pools",
        "mikrotik_routers", "olts", "onus",
        "categories", "products", "suppliers",
        "payment_gateways",
        "activity_logs", "audit_logs", "admin_login_logs", "admin_sessions",
        "role_permissions", "user_roles", "custom_roles",
        "daily_reports",
        "tenant_company_info",
        // Subscriptions & domains (top-level tenant relations)
        "subscription_invoices", "subscriptions",
        "demo_requests",
        "domains", "profiles",
      ];
      for (const table of childTables) {
        try {
          await (supabase.from as any)(table).delete().eq("tenant_id", id);
        } catch (e) {
          console.warn(`Cascade delete ${table}:`, e);
        }
      }
      return sbDelete("tenants", id);
    }
    return request(`/tenants/${id}`, { method: "DELETE" });
  },

  // Plans
  getPlans: async () => {
    if (IS_LOVABLE) return sbSelect("saas_plans");
    return request("/plans");
  },
  createPlan: async (data: any) => {
    if (IS_LOVABLE) return sbInsert("saas_plans", data);
    return request("/plans", { method: "POST", body: JSON.stringify(data) });
  },
  updatePlan: async (id: string, data: any) => {
    if (IS_LOVABLE) return sbUpdate("saas_plans", id, data);
    return request(`/plans/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deletePlan: async (id: string) => {
    if (IS_LOVABLE) return sbDelete("saas_plans", id);
    return request(`/plans/${id}`, { method: "DELETE" });
  },

  // Modules
  getModules: async () => {
    if (IS_LOVABLE) return sbSelect("modules");
    return request("/modules");
  },
  updateModule: async (id: string, data: any) => {
    if (IS_LOVABLE) return sbUpdate("modules", id, data);
    return request(`/modules/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  getTenantModules: (tenantId: string) => request(`/tenants/${tenantId}/modules`),

  // Subscriptions
  getSubscriptions: async (params?: Record<string, string>) => {
    if (IS_LOVABLE) {
      const subs = await sbSelect("subscriptions");
      const tenants = await sbSelect("tenants");
      const plans = await sbSelect("saas_plans");
      return subs.map((s: any) => ({
        ...s,
        tenant: tenants.find((t: any) => t.id === s.tenant_id),
        plan: plans.find((p: any) => p.id === s.plan_id),
      }));
    }
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/subscriptions${qs}`);
  },
  assignSubscription: async (data: any) => {
    if (IS_LOVABLE) {
      const plans = await sbSelect("saas_plans");
      const plan = plans.find((p: any) => p.id === data.plan_id);
      const amount = data.billing_cycle === "yearly" ? Number(plan?.price_yearly || 0) : Number(plan?.price_monthly || 0);
      const startDate = data.start_date || new Date().toISOString().split("T")[0];
      const endDate = data.billing_cycle === "yearly"
        ? new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1)).toISOString().split("T")[0]
        : new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString().split("T")[0];

      // Create subscription
      const result = await sbInsert("subscriptions", {
        tenant_id: data.tenant_id,
        plan_id: data.plan_id,
        billing_cycle: data.billing_cycle,
        start_date: startDate,
        end_date: endDate,
        amount,
        status: "active",
      });

      // Update tenant plan_expire_date and plan_id
      await sbUpdate("tenants", data.tenant_id, {
        plan_expire_date: endDate,
        plan_id: data.plan_id,
        status: "active",
      });

      return result;
    }
    return request("/subscriptions", { method: "POST", body: JSON.stringify(data) });
  },
  updateSubscription: async (id: string, data: any) => {
    if (IS_LOVABLE) return sbUpdate("subscriptions", id, data);
    return request(`/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteSubscription: async (id: string) => {
    if (IS_LOVABLE) {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    }
    return request(`/subscriptions/${id}`, { method: "DELETE" });
  },

  // Domains
  getDomains: async () => {
    if (IS_LOVABLE) {
      const domains = await sbSelect("domains");
      const tenants = await sbSelect("tenants");
      return domains.map((d: any) => ({
        ...d,
        tenant: tenants.find((t: any) => t.id === d.tenant_id),
      }));
    }
    return request("/domains");
  },
  assignDomain: async (data: any) => {
    if (IS_LOVABLE) {
      return sbInsert("domains", {
        tenant_id: data.tenant_id,
        domain: data.domain,
        is_primary: true,
        is_verified: false,
      });
    }
    return request("/domains", { method: "POST", body: JSON.stringify(data) });
  },
  removeDomain: async (id: string) => {
    if (IS_LOVABLE) return sbDelete("domains", id);
    return request(`/domains/${id}`, { method: "DELETE" });
  },

  // SMS Management
  getSmsSettings: async () => {
    if (IS_LOVABLE) {
      const data = await sbSelect("sms_settings");
      return data[0] || {};
    }
    return request("/sms-settings");
  },
  updateSmsSettings: (data: any) => request("/sms-settings", { method: "PUT", body: JSON.stringify(data) }),
  getSmsWallets: async () => {
    if (IS_LOVABLE) {
      const wallets = await sbSelect("sms_wallets");
      const tenants = await sbSelect("tenants");
      return wallets.map((w: any) => ({
        ...w,
        tenant: tenants.find((t: any) => t.id === w.tenant_id),
      }));
    }
    return request("/sms-wallets");
  },
  rechargeSms: async (data: any) => {
    if (IS_LOVABLE) {
      // Update wallet balance
      const wallets = await sbSelect("sms_wallets");
      const wallet = wallets.find((w: any) => w.tenant_id === data.tenant_id);
      if (wallet) {
        await sbUpdate("sms_wallets", wallet.id, { balance: Number(wallet.balance) + Number(data.amount) });
      } else {
        await sbInsert("sms_wallets", { tenant_id: data.tenant_id, balance: data.amount });
      }
      // Log transaction
      await sbInsert("sms_transactions", {
        tenant_id: data.tenant_id,
        amount: data.amount,
        type: "credit",
        description: data.description || "SMS Recharge by Super Admin",
      });
      return { success: true };
    }
    return request("/sms-recharge", { method: "POST", body: JSON.stringify(data) });
  },
  getSmsTransactions: async (params?: Record<string, string>) => {
    if (IS_LOVABLE) {
      let data = await sbSelect("sms_transactions");
      if (params?.tenant_id) {
        data = data.filter((t: any) => t.tenant_id === params.tenant_id);
      }
      return data;
    }
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/sms-transactions${qs}`);
  },

  // Impersonation — creates a real admin session for the tenant's admin user
  impersonateTenant: async (tenantId: string) => {
    if (IS_LOVABLE) {
      // Find the tenant's admin user
      const profiles = await sbSelect("profiles", { filters: { tenant_id: tenantId } });
      const tenants = await sbSelect("tenants");
      const tenant = tenants.find((t: any) => t.id === tenantId);
      if (!tenant) throw new Error("Tenant not found");

      // Prefer owner/admin role user, fallback to first user
      const user = profiles.find((p: any) => p.status === "active") || profiles[0];
      if (!user) throw new Error("No users found for this tenant");

      // Create a real admin session token
      const sessionToken = crypto.randomUUID();
      const { error: sessionError } = await supabase
        .from("admin_sessions")
        .insert({
          admin_id: user.id,
          session_token: sessionToken,
          ip_address: "super-admin-impersonation",
          browser: "Impersonation",
          device_name: "Super Admin Panel",
          status: "active",
        });
      if (sessionError) throw new Error("Failed to create session: " + sessionError.message);

      return {
        token: sessionToken,
        tenant: { id: tenantId, name: tenant.name, subdomain: tenant.subdomain },
        user: { id: user.id, name: user.full_name, email: user.email, role: "admin", avatar_url: user.avatar_url },
      };
    }
    return request(`/tenants/${tenantId}/impersonate`, { method: "POST" });
  },

  // Tenant Users
  getTenantUsers: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const profiles = await sbSelect("profiles", { filters: { tenant_id: tenantId } });
      const roles = await sbSelect("user_roles");
      return profiles.map((p: any) => {
        const userRole = roles.find((r: any) => r.user_id === p.id);
        return {
          ...p,
          role: userRole?.role || "staff",
          custom_role_id: userRole?.custom_role_id || null,
        };
      });
    }
    return request(`/tenants/${tenantId}/users`);
  },
  updateTenantUser: async (tenantId: string, userId: string, data: any) => {
    if (IS_LOVABLE) {
      const { role, password, must_change_password, ...profileData } = data;
      // Update profile fields
      const updatePayload: any = { ...profileData };
      if (must_change_password !== undefined) updatePayload.must_change_password = must_change_password;
      if (password) {
        updatePayload.password_hash = hashPassword(password);
      }
      if (Object.keys(updatePayload).length > 0) {
        const { error } = await (supabase.from as any)("profiles").update(updatePayload).eq("id", userId);
        if (error) throw new Error(error.message);
      }
      // Update role if provided
      if (role) {
        const existingRoles = await sbSelect("user_roles", { filters: { user_id: userId } });
        if (existingRoles.length > 0) {
          await sbUpdate("user_roles", existingRoles[0].id, { role });
        } else {
          await sbInsert("user_roles", { user_id: userId, role });
        }
      }
      return { success: true };
    }
    return request(`/tenants/${tenantId}/users/${userId}`, { method: "PUT", body: JSON.stringify(data) });
  },

  // Tenant Activity Logs
  getTenantActivityLogs: async (tenantId: string) => {
    if (IS_LOVABLE) {
      return sbSelect("activity_logs");
    }
    return request(`/tenants/${tenantId}/activity-logs`);
  },

  // Tenant Login History
  getTenantLoginHistory: async (tenantId: string) => {
    if (IS_LOVABLE) {
      return sbSelect("login_histories");
    }
    return request(`/tenants/${tenantId}/login-history`);
  },

  // Tenant Sessions
  getTenantSessions: async (tenantId: string) => {
    if (IS_LOVABLE) {
      return sbSelect("admin_sessions");
    }
    return request(`/tenants/${tenantId}/sessions`);
  },

  // Force terminate session
  forceTerminateSession: async (sessionId: string) => {
    if (IS_LOVABLE) {
      return sbUpdate("admin_sessions", sessionId, { status: "force_terminated" });
    }
    return request(`/sessions/${sessionId}/force-terminate`, { method: "POST" });
  },

  // SMTP Settings
  getSmtpSettings: async () => {
    if (IS_LOVABLE) {
      return invokeSuperAdminEdge("super-admin-smtp", { method: "GET" });
    }
    return request("/smtp-settings");
  },
  updateSmtpSettings: async (data: any) => {
    if (IS_LOVABLE) {
      const payload = {
        host: data.host || "",
        port: Number(data.port) || 587,
        username: data.username || "",
        password: data.password || "",
        encryption: data.encryption || "tls",
        from_email: data.from_email || "",
        from_name: data.from_name || "Smart ISP",
        status: data.status || "active",
      };
      return invokeSuperAdminEdge("super-admin-smtp", { method: "PUT", body: payload });
    }
    return request("/smtp-settings", { method: "PUT", body: JSON.stringify(data) });
  },
  testSmtp: async (to: string) => {
    if (IS_LOVABLE) {
      return invokeSuperAdminEdge("super-admin-smtp", { method: "POST", body: { to } });
    }
    return request("/smtp-test", { method: "POST", body: JSON.stringify({ to }) });
  },

  // Create tenant user (multi-admin)
  createTenantUser: async (tenantId: string, data: any) => {
    if (IS_LOVABLE) {
      if (!data.password) throw new Error("Password is required");
      const newId = crypto.randomUUID();
      const { data: existing } = await (supabase.from as any)("profiles").select("id").eq("username", data.username).maybeSingle();
      if (existing) throw new Error("Username already taken");
      const { error } = await (supabase.from as any)("profiles").insert({
        id: newId,
        full_name: data.full_name,
        username: data.username,
        email: data.email || null,
        mobile: data.mobile || null,
        staff_id: data.staff_id || null,
        address: data.address || null,
        password_hash: hashPassword(data.password),
        status: "active",
        must_change_password: true,
        tenant_id: tenantId,
      });
      if (error) throw new Error(error.message);
      if (data.role) {
        await sbInsert("user_roles", { user_id: newId, role: data.role });
      }
      return { success: true, user_id: newId };
    }
    return request(`/tenants/${tenantId}/users`, { method: "POST", body: JSON.stringify(data) });
  },

  // ── Tenant Financial Reports (with Supabase fallback) ──────────────────────────

  getTenantReportOverview: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const currentMonth = new Date().toISOString().substring(0, 7);

      // Get tenant-scoped customers first
      const customers = await sbSelect("customers", { filters: { tenant_id: tenantId } });
      const customerIds = customers.map((c: any) => c.id);

      // Get bills and payments scoped to tenant customers
      let bills: any[] = [];
      let payments: any[] = [];
      if (customerIds.length > 0) {
        const { data: billsData } = await (supabase.from as any)("bills").select("*").in("customer_id", customerIds);
        bills = billsData || [];
        const { data: paymentsData } = await (supabase.from as any)("payments").select("*").in("customer_id", customerIds);
        payments = paymentsData || [];
      }
      const smsWallet = await sbSelect("sms_wallets", { filters: { tenant_id: tenantId } }).catch(() => []);

      const activeCustomers = customers.filter((c: any) => c.status === "active");
      const suspendedCustomers = customers.filter((c: any) => c.status === "suspended");
      const onlineCustomers = customers.filter((c: any) => c.connection_status === "online");
      const offlineCustomers = customers.filter((c: any) => c.connection_status === "offline");

      const currentBills = bills.filter((b: any) => b.month === currentMonth);
      const paidCurrentBills = currentBills.filter((b: any) => b.status === "paid");
      const monthlyRevenue = paidCurrentBills.reduce((s: number, b: any) => s + Number(b.paid_amount || b.amount || 0), 0);
      const totalDue = currentBills.filter((b: any) => b.status === "unpaid").reduce((s: number, b: any) => s + Number(b.amount || 0) - Number(b.paid_amount || 0), 0);
      const alltimeDue = bills.filter((b: any) => b.status === "unpaid").reduce((s: number, b: any) => s + Number(b.amount || 0) - Number(b.paid_amount || 0), 0);
      const totalRevenue = bills.filter((b: any) => b.status === "paid").reduce((s: number, b: any) => s + Number(b.paid_amount || b.amount || 0), 0);

      if (totalRevenue === 0 && payments.length > 0) {
        const paidPayments = payments.filter((p: any) => p.status === "completed");
        const paymentRevenue = paidPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        const monthPaymentRevenue = paidPayments.filter((p: any) => p.paid_at?.startsWith(currentMonth)).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        
        return {
          total_customers: customers.length,
          active_customers: activeCustomers.length,
          suspended_customers: suspendedCustomers.length,
          online_customers: onlineCustomers.length,
          offline_customers: offlineCustomers.length,
          support_tickets: 0,
          monthly_revenue: monthPaymentRevenue,
          total_due: totalDue,
          alltime_due: alltimeDue,
          total_revenue: paymentRevenue,
          sms_balance: smsWallet?.[0]?.balance || 0,
        };
      }

      return {
        total_customers: customers.length,
        active_customers: activeCustomers.length,
        suspended_customers: suspendedCustomers.length,
        online_customers: onlineCustomers.length,
        offline_customers: offlineCustomers.length,
        support_tickets: 0,
        monthly_revenue: monthlyRevenue,
        total_due: totalDue,
        alltime_due: alltimeDue,
        total_revenue: totalRevenue,
        sms_balance: smsWallet?.[0]?.balance || 0,
      };
    }
    return request(`/tenants/${tenantId}/reports/overview`);
  },

  getTenantReportRevenue: async (tenantId: string, from?: string, to?: string) => {
    if (IS_LOVABLE) {
      const payments = await sbSelectByTenantCustomers("payments", tenantId);
      const completed = payments.filter((p: any) => p.status === "completed");
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recent = completed.filter((p: any) => new Date(p.paid_at || p.created_at) >= thirtyDaysAgo);

      const dailyMap: Record<string, number> = {};
      recent.forEach((p: any) => {
        const d = (p.paid_at || p.created_at)?.substring(0, 10);
        dailyMap[d] = (dailyMap[d] || 0) + Number(p.amount || 0);
      });
      const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));

      const methodMap: Record<string, { total: number; count: number }> = {};
      completed.forEach((p: any) => {
        const m = p.payment_method || "cash";
        if (!methodMap[m]) methodMap[m] = { total: 0, count: 0 };
        methodMap[m].total += Number(p.amount || 0);
        methodMap[m].count++;
      });
      const by_method = Object.entries(methodMap).map(([payment_method, v]) => ({ payment_method, ...v }));

      return { daily, by_method };
    }
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/tenants/${tenantId}/reports/revenue?${params}`);
  },

  getTenantReportExpense: async (tenantId: string, from?: string, to?: string) => {
    if (IS_LOVABLE) {
      const expenses = await sbSelect("expenses"); // expenses don't have tenant_id yet, show all for now
      const catMap: Record<string, number> = {};
      expenses.forEach((e: any) => {
        const cat = e.category || "other";
        catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
      });
      const by_category = Object.entries(catMap).map(([category, total]) => ({ category, total }));

      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recent = expenses.filter((e: any) => new Date(e.date || e.created_at) >= thirtyDaysAgo);
      const dailyMap: Record<string, number> = {};
      recent.forEach((e: any) => {
        const d = (e.date || e.created_at)?.substring(0, 10);
        dailyMap[d] = (dailyMap[d] || 0) + Number(e.amount || 0);
      });
      const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));

      return { by_category, daily };
    }
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/tenants/${tenantId}/reports/expense?${params}`);
  },

  getTenantReportProfitLoss: async (tenantId: string, year?: number) => {
    if (IS_LOVABLE) {
      const yr = year || new Date().getFullYear();
      const [payments, expenses] = await Promise.all([
        sbSelectByTenantCustomers("payments", tenantId),
        sbSelect("expenses"),
      ]);
      const completed = payments.filter((p: any) => p.status === "completed");
      const months: any[] = [];
      let yearlyRevenue = 0, yearlyExpense = 0;

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${yr}-${String(m).padStart(2, "0")}`;
        const monthLabel = new Date(yr, m - 1).toLocaleString("default", { month: "short" });
        const rev = completed.filter((p: any) => (p.paid_at || p.created_at)?.startsWith(monthStr))
          .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        const exp = expenses.filter((e: any) => (e.date || e.created_at)?.startsWith(monthStr))
          .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
        yearlyRevenue += rev;
        yearlyExpense += exp;
        months.push({ month: monthLabel, revenue: rev, expense: exp, profit: rev - exp });
      }

      return { months, yearly: { revenue: yearlyRevenue, expense: yearlyExpense, profit: yearlyRevenue - yearlyExpense } };
    }
    const params = year ? `?year=${year}` : "";
    return request(`/tenants/${tenantId}/reports/profit-loss${params}`);
  },

  getTenantReportInvoices: async (tenantId: string, month?: string) => {
    if (IS_LOVABLE) {
      const m = month || new Date().toISOString().substring(0, 7);
      const bills = await sbSelectByTenantCustomers("bills", tenantId);
      const filtered = bills.filter((b: any) => b.month === m);
      return { month: m, bills: filtered };
    }
    const params = month ? `?month=${month}` : "";
    return request(`/tenants/${tenantId}/reports/invoices${params}`);
  },

  getTenantReportPayments: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const payments = await sbSelectByTenantCustomers("payments", tenantId);
      const recent = payments.sort((a: any, b: any) => (b.paid_at || b.created_at || "").localeCompare(a.paid_at || a.created_at || "")).slice(0, 50);
      return { payments: recent, total: payments.length };
    }
    return request(`/tenants/${tenantId}/reports/payments`);
  },

  getTenantReportCustomers: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const customers = await sbSelect("customers", { filters: { tenant_id: tenantId } });
      const byArea: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      customers.forEach((c: any) => {
        byArea[c.area || "Unknown"] = (byArea[c.area || "Unknown"] || 0) + 1;
        byStatus[c.connection_status || "unknown"] = (byStatus[c.connection_status || "unknown"] || 0) + 1;
      });
      return {
        total: customers.length,
        by_area: Object.entries(byArea).map(([area, count]) => ({ area, count })),
        by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      };
    }
    return request(`/tenants/${tenantId}/reports/customers`);
  },

  getTenantReportSms: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const [logs, wallet] = await Promise.all([
        sbSelect("sms_logs").catch(() => []),
        sbSelect("sms_wallets").catch(() => []),
      ]);
      const byType: Record<string, number> = {};
      logs.forEach((l: any) => {
        byType[l.sms_type || "general"] = (byType[l.sms_type || "general"] || 0) + 1;
      });
      return {
        total_sent: logs.length,
        balance: wallet?.[0]?.balance || 0,
        by_type: Object.entries(byType).map(([type, count]) => ({ type, count })),
      };
    }
    return request(`/tenants/${tenantId}/reports/sms`);
  },

  getTenantReportLedger: async (tenantId: string, from?: string, to?: string) => {
    if (IS_LOVABLE) {
      const transactions = await sbSelect("transactions").catch(() => []);
      const recent = transactions.sort((a: any, b: any) => (b.date || "").localeCompare(a.date || "")).slice(0, 100);
      return { entries: recent };
    }
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/tenants/${tenantId}/reports/ledger?${params}`);
  },

  getTenantReportTrialBalance: async (tenantId: string, from?: string, to?: string) => {
    if (IS_LOVABLE) {
      const accounts = await sbSelect("accounts").catch(() => []);
      const items = accounts.filter((a: any) => a.is_active !== false).map((a: any) => ({
        code: a.code, name: a.name, type: a.type,
        debit: ["asset", "expense"].includes(a.type) ? Math.max(Number(a.balance || 0), 0) : 0,
        credit: ["liability", "equity", "income"].includes(a.type) ? Math.max(Number(a.balance || 0), 0) : 0,
      }));
      return { accounts: items };
    }
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/tenants/${tenantId}/reports/trial-balance?${params}`);
  },

  getTenantReportBalanceSheet: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const accounts = await sbSelect("accounts").catch(() => []);
      const assets = accounts.filter((a: any) => a.type === "asset" && a.is_active !== false);
      const liabilities = accounts.filter((a: any) => a.type === "liability" && a.is_active !== false);
      const equity = accounts.filter((a: any) => a.type === "equity" && a.is_active !== false);
      return {
        assets: assets.map((a: any) => ({ name: a.name, balance: Number(a.balance || 0) })),
        liabilities: liabilities.map((a: any) => ({ name: a.name, balance: Number(a.balance || 0) })),
        equity: equity.map((a: any) => ({ name: a.name, balance: Number(a.balance || 0) })),
        total_assets: assets.reduce((s: number, a: any) => s + Number(a.balance || 0), 0),
        total_liabilities: liabilities.reduce((s: number, a: any) => s + Number(a.balance || 0), 0),
        total_equity: equity.reduce((s: number, a: any) => s + Number(a.balance || 0), 0),
      };
    }
    return request(`/tenants/${tenantId}/reports/balance-sheet`);
  },

  getTenantReportAccountBalances: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const accounts = await sbSelect("accounts").catch(() => []);
      return { accounts: accounts.filter((a: any) => a.is_active !== false).map((a: any) => ({ id: a.id, code: a.code, name: a.name, type: a.type, balance: Number(a.balance || 0) })) };
    }
    return request(`/tenants/${tenantId}/reports/account-balances`);
  },

  getTenantReportReceivablePayable: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const customers = await sbSelect("customers", { filters: { tenant_id: tenantId } });
      const customerIds = customers.map((c: any) => c.id);
      let bills: any[] = [];
      if (customerIds.length > 0) {
        const { data } = await (supabase.from as any)("bills").select("*").in("customer_id", customerIds);
        bills = data || [];
      }
      const unpaidBills = bills.filter((b: any) => b.status !== "paid");
      const receivableMap: Record<string, { name: string; due: number }> = {};
      unpaidBills.forEach((b: any) => {
        const cust = customers.find((c: any) => c.id === b.customer_id);
        if (!receivableMap[b.customer_id]) receivableMap[b.customer_id] = { name: cust?.name || "Unknown", due: 0 };
        receivableMap[b.customer_id].due += Number(b.amount || 0) - Number(b.paid_amount || 0);
      });
      const receivables = Object.values(receivableMap).filter(r => r.due > 0).sort((a, b) => b.due - a.due);
      return { receivables, total_receivable: receivables.reduce((s, r) => s + r.due, 0), payables: [], total_payable: 0 };
    }
    return request(`/tenants/${tenantId}/reports/receivable-payable`);
  },

  getTenantReportInventory: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const products = await sbSelect("products").catch(() => []);
      const totalValue = products.reduce((s: number, p: any) => s + (Number(p.stock_quantity || 0) * Number(p.cost_price || 0)), 0);
      const lowStock = products.filter((p: any) => p.stock_quantity <= (p.low_stock_alert || 0));
      return { products, total_value: totalValue, low_stock: lowStock, total_items: products.length };
    }
    return request(`/tenants/${tenantId}/reports/inventory`);
  },

  getTenantReportCashFlow: async (tenantId: string, year?: number) => {
    if (IS_LOVABLE) {
      const yr = year || new Date().getFullYear();
      const [payments, expenses] = await Promise.all([
        sbSelectByTenantCustomers("payments", tenantId),
        sbSelect("expenses"),
      ]);
      const completed = payments.filter((p: any) => p.status === "completed");
      const months: any[] = [];

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${yr}-${String(m).padStart(2, "0")}`;
        const monthLabel = new Date(yr, m - 1).toLocaleString("default", { month: "short" });
        const inflow = completed.filter((p: any) => (p.paid_at || p.created_at)?.startsWith(monthStr))
          .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        const outflow = expenses.filter((e: any) => (e.date || e.created_at)?.startsWith(monthStr))
          .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
        months.push({ month: monthLabel, inflow, outflow, net: inflow - outflow });
      }

      return { months };
    }
    const params = year ? `?year=${year}` : "";
    return request(`/tenants/${tenantId}/reports/cash-flow${params}`);
  },

  // ── Backup & Recovery ──────────────────────────────
  getBackupLogs: async () => {
    if (IS_LOVABLE) {
      try {
        const data = await request("/backups/logs");
        if (Array.isArray(data)) return data;
        if (Array.isArray((data as any)?.data)) return (data as any).data;
        if (Array.isArray((data as any)?.logs)) return (data as any).logs;
      } catch (error) {
        console.warn("Falling back to Supabase backup logs in Lovable preview", error);
      }

      const { data, error } = await supabase
        .from("backup_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);
      return data || [];
    }
    return request("/backups/logs");
  },
  createFullBackup: () => request("/backups/full", { method: "POST" }),
  createTenantBackup: (tenantId: string) => request("/backups/tenant", { method: "POST", body: JSON.stringify({ tenant_id: tenantId }) }),
  restoreFullBackup: (filePath: string) => request("/backups/restore-full", { method: "POST", body: JSON.stringify({ file_path: filePath }) }),
  restoreTenantBackup: (tenantId: string, filePath: string) => request("/backups/restore-tenant", { method: "POST", body: JSON.stringify({ tenant_id: tenantId, file_path: filePath }) }),
  verifyBackup: (filePath: string) => request("/backups/verify", { method: "POST", body: JSON.stringify({ file_path: filePath }) }),
  rollbackBackup: (type: string, tenantId?: string) => request("/backups/rollback", { method: "POST", body: JSON.stringify({ type, tenant_id: tenantId }) }),
  deleteBackup: (filePath: string) => request("/backups/delete", { method: "POST", body: JSON.stringify({ file_path: filePath }) }),
  cleanupBackups: (keepDays: number) => request("/backups/cleanup", { method: "POST", body: JSON.stringify({ keep_days: keepDays }) }),
  getAutoBackupSettings: () => request("/backups/auto-settings"),
  updateAutoBackupSettings: (data: { enabled: boolean; frequency: string; keep_count: number }) => request("/backups/auto-settings", { method: "PUT", body: JSON.stringify(data) }),
  downloadBackup: (filePath: string) => {
    const token = getToken();
    const url = `${BASE()}/backups/download?file_path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;
    window.open(url, "_blank");
  },
};
