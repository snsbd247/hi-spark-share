import { API_BASE_URL } from "@/lib/apiBaseUrl";

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

export const superAdminApi = {
  // Dashboard
  dashboard: () => request("/dashboard"),

  // Tenants
  getTenants: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/tenants${qs}`);
  },
  createTenant: (data: any) => request("/tenants", { method: "POST", body: JSON.stringify(data) }),
  updateTenant: (id: string, data: any) => request(`/tenants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  suspendTenant: (id: string) => request(`/tenants/${id}/suspend`, { method: "POST" }),
  activateTenant: (id: string) => request(`/tenants/${id}/activate`, { method: "POST" }),
  deleteTenant: (id: string) => request(`/tenants/${id}`, { method: "DELETE" }),

  // Plans
  getPlans: () => request("/plans"),
  createPlan: (data: any) => request("/plans", { method: "POST", body: JSON.stringify(data) }),
  updatePlan: (id: string, data: any) => request(`/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlan: (id: string) => request(`/plans/${id}`, { method: "DELETE" }),

  // Modules
  getModules: () => request("/modules"),
  updateModule: (id: string, data: any) => request(`/modules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getTenantModules: (tenantId: string) => request(`/tenants/${tenantId}/modules`),

  // Subscriptions
  getSubscriptions: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/subscriptions${qs}`);
  },
  assignSubscription: (data: any) => request("/subscriptions", { method: "POST", body: JSON.stringify(data) }),

  // Domains
  getDomains: () => request("/domains"),
  assignDomain: (data: any) => request("/domains", { method: "POST", body: JSON.stringify(data) }),
  removeDomain: (id: string) => request(`/domains/${id}`, { method: "DELETE" }),

  // SMS Management
  getSmsSettings: () => request("/sms-settings"),
  updateSmsSettings: (data: any) => request("/sms-settings", { method: "PUT", body: JSON.stringify(data) }),
  getSmsWallets: () => request("/sms-wallets"),
  rechargeSms: (data: any) => request("/sms-recharge", { method: "POST", body: JSON.stringify(data) }),
  getSmsTransactions: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/sms-transactions${qs}`);
  },
};
