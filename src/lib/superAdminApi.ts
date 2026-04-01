import { API_BASE_URL } from "@/lib/apiBaseUrl";
import { IS_LOVABLE } from "@/lib/environment";
import { supabase } from "@/integrations/supabase/client";

const BASE = () => `${API_BASE_URL}/super-admin`;

function getToken(): string {
  return localStorage.getItem("super_admin_token") || "";
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE()}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });

  if (res.status === 401) {
    localStorage.removeItem("super_admin_token");
    localStorage.removeItem("super_admin_user");
    window.location.href = "/super/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || "Request failed");
  }

  return res.json();
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
      let data = await sbSelect("tenants");
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
    if (IS_LOVABLE) return sbDelete("tenants", id);
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
      return sbInsert("subscriptions", {
        tenant_id: data.tenant_id,
        plan_id: data.plan_id,
        billing_cycle: data.billing_cycle,
        start_date: startDate,
        end_date: endDate,
        amount,
        status: "active",
      });
    }
    return request("/subscriptions", { method: "POST", body: JSON.stringify(data) });
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

  // Impersonation
  impersonateTenant: async (tenantId: string) => {
    if (IS_LOVABLE) {
      // In Lovable preview, create a mock impersonation
      const users = await sbSelect("profiles");
      const tenants = await sbSelect("tenants");
      const tenant = tenants.find((t: any) => t.id === tenantId);
      // Find any user — in preview mode we simulate
      const user = users[0];
      if (!user) throw new Error("No users found for this tenant");
      return {
        token: "mock_impersonation_" + Date.now(),
        tenant: { id: tenantId, name: tenant?.name, subdomain: tenant?.subdomain },
        user: { id: user.id, name: user.full_name },
        mock: true,
      };
    }
    return request(`/tenants/${tenantId}/impersonate`, { method: "POST" });
  },

  // Tenant Users
  getTenantUsers: async (tenantId: string) => {
    if (IS_LOVABLE) {
      const profiles = await sbSelect("profiles");
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
      // password can't be hashed client-side for Supabase preview, skip
      if (Object.keys(updatePayload).length > 0) {
        await sbUpdate("profiles", userId, updatePayload);
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
      const data = await sbSelect("smtp_settings");
      return data[0] || {};
    }
    return request("/smtp-settings");
  },
  updateSmtpSettings: async (data: any) => {
    if (IS_LOVABLE) {
      const existing = await sbSelect("smtp_settings");
      if (existing.length > 0) {
        return sbUpdate("smtp_settings", existing[0].id, data);
      }
      return sbInsert("smtp_settings", data);
    }
    return request("/smtp-settings", { method: "PUT", body: JSON.stringify(data) });
  },
  testSmtp: async (to: string) => {
    if (IS_LOVABLE) {
      return { success: true, message: "Test email simulated (preview mode)" };
    }
    return request("/smtp-test", { method: "POST", body: JSON.stringify({ to }) });
  },

  // Create tenant user (multi-admin)
  createTenantUser: async (tenantId: string, data: any) => {
    if (IS_LOVABLE) {
      const newId = crypto.randomUUID();
      const { data: existing } = await (supabase.from as any)("profiles").select("id").eq("username", data.username).maybeSingle();
      if (existing) throw new Error("Username already taken");
      await sbInsert("profiles", {
        id: newId,
        full_name: data.full_name,
        username: data.username,
        email: data.email || null,
        mobile: data.mobile || null,
        staff_id: data.staff_id || null,
        address: data.address || null,
        status: "active",
        must_change_password: true,
      });
      if (data.role) {
        await sbInsert("user_roles", { user_id: newId, role: data.role });
      }
      return { success: true, user_id: newId };
    }
    return request(`/tenants/${tenantId}/users`, { method: "POST", body: JSON.stringify(data) });
  },
};
