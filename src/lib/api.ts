import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, IS_LOVABLE_RUNTIME } from '@/lib/apiBaseUrl';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { apiHealth, friendlyErrorMessage } from '@/lib/apiHealth';
import { toast } from 'sonner';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();
const canUseEdgeFallback = IS_LOVABLE_RUNTIME && !!SUPABASE_URL && !!SUPABASE_PUBLISHABLE_KEY;

type AnyRecord = Record<string, any>;

type ProxyFilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in";

interface ProxyFilter {
  column: string;
  op: ProxyFilterOp;
  value: any;
}

const isNetworkError = (error: any) =>
  !error?.response && (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK');

const normalizePath = (url?: string) => {
  if (!url) return '/';
  const noQuery = url.split('?')[0];
  return noQuery.startsWith('/') ? noQuery : `/${noQuery}`;
};

const parseJsonData = (data: any): AnyRecord => {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data;
};

const parseAdminUser = () => {
  const raw = localStorage.getItem('admin_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getBearerToken = async (config?: InternalAxiosRequestConfig | any) => {
  const configAuth = (config?.headers as any)?.Authorization || (config?.headers as any)?.authorization;
  if (typeof configAuth === 'string' && configAuth.trim()) {
    return configAuth.replace(/^Bearer\s+/i, '').trim();
  }

  const localToken = localStorage.getItem('admin_token');
  if (localToken) return localToken;

  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token || '';
};

const toAxiosResponse = (
  config: InternalAxiosRequestConfig | any,
  data: any,
  status = 200,
): AxiosResponse => ({
  data,
  status,
  statusText: status >= 200 && status < 300 ? 'OK' : 'ERROR',
  headers: {},
  config,
});

const invokeEdgeHttp = async (
  edgePath: string,
  method: 'GET' | 'POST' = 'POST',
  body?: any,
  bearerToken?: string,
) => {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase runtime is not configured');
  }

  const headers: Record<string, string> = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
  };

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${edgePath.replace(/^\/+/, '')}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      // Session expired — clear stale token and redirect to login
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }
    const error = new Error(payload?.error || payload?.message || `Edge request failed (${response.status})`) as Error & {
      status?: number;
      data?: any;
    };
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  return payload;
};

const invokeDataProxy = async (payload: AnyRecord, bearerToken?: string) => {
  return invokeEdgeHttp('api/data/proxy', 'POST', payload, bearerToken);
};

const toSupplierPayload = (raw: AnyRecord) => ({
  name: raw.name,
  phone: raw.phone || null,
  email: raw.email || null,
  company: raw.company || null,
  address: raw.address || null,
  status: raw.status || 'active',
  total_due: Number(raw.balance ?? raw.total_due ?? 0),
  updated_at: new Date().toISOString(),
});

const toVendorPayload = (supplier: AnyRecord) => ({
  ...supplier,
  balance: Number(supplier.total_due ?? 0),
  notes: supplier.notes || '',
});

const handleGenericTableFallback = async (
  config: InternalAxiosRequestConfig,
  resource: string,
  resourceId?: string,
) => {
  // Map URL resource names (hyphenated) to Supabase table names (underscored)
  const table = resource === 'vendors' ? 'suppliers' : resource.replace(/-/g, '_');
  const method = (config.method || 'get').toLowerCase();
  const bearerToken = await getBearerToken(config);
  const payload = parseJsonData(config.data);

  if (method === 'get') {
    const response = await invokeDataProxy(
      {
        table,
        operation: 'select',
        select: '*',
        filters: resourceId ? [{ column: 'id', op: 'eq', value: resourceId } as ProxyFilter] : [],
        order: [],
        single: false,
        maybeSingle: false,
      },
      bearerToken,
    );

    let rows = Array.isArray(response?.data) ? response.data : response?.data ? [response.data] : [];
    if (resource === 'vendors') rows = rows.map(toVendorPayload);
    return toAxiosResponse(config, rows);
  }

  if (method === 'post') {
    const insertData = resource === 'vendors' ? toSupplierPayload(payload) : payload;
    const response = await invokeDataProxy(
      {
        table,
        operation: 'insert',
        select: '*',
        filters: [],
        order: [],
        data: insertData,
      },
      bearerToken,
    );

    if (resource === 'vendors') {
      const row = Array.isArray(response?.data) ? response.data[0] : response?.data;
      return toAxiosResponse(config, toVendorPayload(row || {}));
    }

    return toAxiosResponse(config, response?.data);
  }

  if (method === 'put') {
    if (!resourceId) throw new Error('Missing resource id');
    const updateData = resource === 'vendors' ? toSupplierPayload(payload) : payload;

    const response = await invokeDataProxy(
      {
        table,
        operation: 'update',
        select: '*',
        filters: [{ column: 'id', op: 'eq', value: resourceId }],
        order: [],
        data: updateData,
      },
      bearerToken,
    );

    if (resource === 'vendors') {
      const row = Array.isArray(response?.data) ? response.data[0] : response?.data;
      return toAxiosResponse(config, toVendorPayload(row || {}));
    }

    return toAxiosResponse(config, response?.data);
  }

  if (method === 'delete') {
    if (!resourceId) throw new Error('Missing resource id');

    const response = await invokeDataProxy(
      {
        table,
        operation: 'delete',
        select: '*',
        filters: [{ column: 'id', op: 'eq', value: resourceId }],
        order: [],
      },
      bearerToken,
    );

    return toAxiosResponse(config, response?.data ?? { success: true });
  }

  throw new Error(`Unsupported method ${method} for ${resource}`);
};

const handleStorageFallback = async (config: InternalAxiosRequestConfig, action: string) => {
  const method = (config.method || 'get').toLowerCase();

  if (action === 'upload' && method === 'post') {
    const formData = config.data as FormData;
    const file = formData?.get('file');
    const bucket = String(formData?.get('bucket') || '');
    const path = String(formData?.get('path') || '');
    const upsert = String(formData?.get('upsert') || '') === 'true';

    if (!bucket || !path || !(file instanceof File)) {
      throw new Error('Invalid upload payload');
    }

    const { data, error } = await supabaseClient.storage.from(bucket).upload(path, file, {
      upsert,
      contentType: file.type || undefined,
    });

    if (error) throw error;
    return toAxiosResponse(config, { path: data.path || path });
  }

  if (action === 'delete' && method === 'post') {
    const payload = parseJsonData(config.data);
    const bucket = String(payload.bucket || '');
    const paths = Array.isArray(payload.paths) ? payload.paths : [];

    if (!bucket) throw new Error('Bucket is required');
    const { error } = await supabaseClient.storage.from(bucket).remove(paths);
    if (error) throw error;
    return toAxiosResponse(config, { success: true });
  }

  if (action === 'list' && method === 'get') {
    const params = (config.params || {}) as AnyRecord;
    const bucket = String(params.bucket || '');
    const prefix = String(params.prefix || '');

    if (!bucket) throw new Error('Bucket is required');
    const { data, error } = await supabaseClient.storage.from(bucket).list(prefix || undefined);
    if (error) throw error;
    return toAxiosResponse(config, data || []);
  }

  if (action === 'download' && method === 'get') {
    const params = (config.params || {}) as AnyRecord;
    const bucket = String(params.bucket || '');
    const path = String(params.path || '');

    if (!bucket || !path) throw new Error('Bucket and path are required');
    const { data, error } = await supabaseClient.storage.from(bucket).download(path);
    if (error) throw error;
    return toAxiosResponse(config, data);
  }

  throw new Error(`Unsupported storage action: ${action}`);
};

const fallbackRequest = async (config: InternalAxiosRequestConfig) => {
  const path = normalizePath(config.url);
  const segments = path.split('/').filter(Boolean);
  const method = (config.method || 'get').toLowerCase();
  const payload = parseJsonData(config.data);
  const bearerToken = await getBearerToken(config);

  if (!segments.length) throw new Error('Invalid API route');

  const [resource, arg1, arg2] = segments;

  // Laravel admin auth endpoints
  if (resource === 'admin' && arg1 === 'login' && method === 'post') {
    const { data, error } = await supabaseClient.functions.invoke('admin-login', {
      body: {
        username: payload.email ?? payload.username,
        password: payload.password,
      },
    });

    if (error || data?.error) {
      throw new Error(error?.message || data?.error || 'Login failed');
    }

    return toAxiosResponse(config, data);
  }

  if (resource === 'admin' && arg1 === 'logout' && method === 'post') {
    return toAxiosResponse(config, { success: true });
  }

  if (resource === 'admin' && arg1 === 'forgot-password' && method === 'post') {
    const email = String(payload.email || '');
    if (!email) throw new Error('Email is required');

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw new Error(error.message);
    return toAxiosResponse(config, { success: true });
  }

  if (resource === 'admin' && arg1 === 'profile' && method === 'put') {
    const user = parseAdminUser();
    if (!user?.id) throw new Error('Not authenticated');

    const response = await invokeDataProxy(
      {
        table: 'profiles',
        operation: 'update',
        select: '*',
        filters: [{ column: 'id', op: 'eq', value: user.id }],
        order: [],
        data: payload,
      },
      bearerToken,
    );

    const row = Array.isArray(response?.data) ? response.data[0] : response?.data;
    return toAxiosResponse(config, row || payload);
  }

  // Generic function proxy calls
  if (resource === 'functions' && arg1 && method === 'post') {
    const { data, error } = await supabaseClient.functions.invoke(arg1, {
      body: payload,
      headers: (config.headers || {}) as Record<string, string>,
    });

    if (error) throw new Error(error.message || `Failed to invoke ${arg1}`);
    return toAxiosResponse(config, data);
  }

  // Storage endpoints
  if (resource === 'storage' && arg1) {
    return handleStorageFallback(config, arg1);
  }

  // Direct edge function routes
  if (resource === 'mikrotik' && arg1 && method === 'post') {
    const data = await invokeEdgeHttp(`mikrotik-sync/${arg1}`, 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'sms' && arg1 === 'send' && method === 'post') {
    const data = await invokeEdgeHttp('send-sms', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'bkash' && arg1 === 'create-payment' && method === 'post') {
    const data = await invokeEdgeHttp('bkash-payment/create', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'bkash' && arg1 === 'execute-payment' && method === 'post') {
    const data = await invokeEdgeHttp('bkash-payment/execute', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'nagad' && arg1 === 'create-payment' && method === 'post') {
    const data = await invokeEdgeHttp('nagad-payment', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  // API function business routes (preserve business logic side-effects)
  if (resource === 'bills' && method === 'post' && arg1 === 'generate') {
    const data = await invokeEdgeHttp('api/bills/generate', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'bills' && method === 'post' && !arg1) {
    const data = await invokeEdgeHttp('api/bills/create', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'bills' && method === 'put' && arg1) {
    const data = await invokeEdgeHttp('api/bills/update', 'POST', { id: arg1, ...payload }, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'bills' && method === 'delete' && arg1) {
    const data = await invokeEdgeHttp('api/bills/delete', 'POST', { id: arg1 }, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'payments' && method === 'post' && !arg1) {
    const data = await invokeEdgeHttp('api/payments/create', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'payments' && method === 'put' && arg1) {
    const data = await invokeEdgeHttp('api/payments/update', 'POST', { id: arg1, ...payload }, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'payments' && method === 'delete' && arg1) {
    const data = await invokeEdgeHttp('api/payments/delete', 'POST', { id: arg1, ...payload }, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'merchant-payments' && method === 'post' && !arg1) {
    const data = await invokeEdgeHttp('api/merchant-payments/create', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'merchant-payments' && method === 'post' && arg2 === 'match' && arg1) {
    const data = await invokeEdgeHttp('api/merchant-payments/match', 'POST', { payment_id: arg1, ...payload }, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'customers' && method === 'post' && !arg1) {
    const data = await invokeEdgeHttp('api/customers/create', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  if (resource === 'tickets' && method === 'post' && !arg1) {
    const data = await invokeEdgeHttp('api/tickets/create', 'POST', payload, bearerToken);
    return toAxiosResponse(config, data);
  }

  // Generic CRUD fallbacks used in accounting pages
  const tableFallbackResources = new Set([
    'products', 'purchases', 'sales', 'expenses', 'vendors', 'suppliers',
    'general-settings', 'payments', 'bills', 'customers', 'packages',
    'support-tickets', 'ticket-replies', 'merchant-payments', 'backup-logs',
    'sms-logs', 'sms-settings', 'sms-templates', 'reminder-logs',
    'audit-logs', 'admin-login-logs', 'admin-sessions', 'mikrotik-routers',
    'olts', 'onus', 'zones', 'profiles', 'user-roles', 'custom-roles',
    'permissions', 'role-permissions', 'payment-gateways', 'daily-reports',
    'accounts', 'transactions', 'purchase-items', 'sale-items',
    'customer-ledger', 'customer-sessions', 'system-settings',
    'designations', 'employees', 'attendance', 'salary-sheets', 'loans',
    'expense-heads', 'income-heads', 'other-heads',
    'employee-education', 'employee-experience', 'employee-emergency-contacts',
    'employee-salary-structure', 'employee-provident-fund', 'employee-savings-fund',
    'supplier-payments',
  ]);
  if (tableFallbackResources.has(resource)) {
    return handleGenericTableFallback(config, resource, arg1);
  }

  // Silently reject unknown routes — no toast needed
  console.warn(`[API Fallback] No route for ${method.toUpperCase()} ${path}`);
  return toAxiosResponse(config, []);
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Attach admin auth token + start timer
api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config._startTime = Date.now();
  return config;
});

// ─── Health-tracked interceptors with retry ────────────────────
api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || '';
    apiHealth.log({
      timestamp: Date.now(),
      source: 'laravel',
      endpoint: url,
      status: 'success',
      responseTime: Date.now() - ((response.config as any)?._startTime || Date.now()),
    });
    return response;
  },
  async (error) => {
    const config = error?.config as InternalAxiosRequestConfig & { _startTime?: number; _retryCount?: number };
    const status = error?.response?.status;
    const url = config?.url || '';

    apiHealth.log({
      timestamp: Date.now(),
      source: 'laravel',
      endpoint: url,
      status: 'error',
      responseTime: Date.now() - (config?._startTime || Date.now()),
      error: error?.message || 'Unknown error',
    });

    // Edge fallback
    if (canUseEdgeFallback && config && (isNetworkError(error) || status === 404)) {
      const edgeStart = Date.now();
      try {
        const result = await fallbackRequest(config);
        apiHealth.log({
          timestamp: Date.now(),
          source: 'edge',
          endpoint: url,
          status: 'success',
          responseTime: Date.now() - edgeStart,
        });
        return result;
      } catch (fallbackError: any) {
        apiHealth.log({
          timestamp: Date.now(),
          source: 'edge',
          endpoint: url,
          status: 'error',
          responseTime: Date.now() - edgeStart,
          error: fallbackError?.message || 'Edge fallback failed',
        });

        if (fallbackError?.status === 401) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/portal')) {
            window.location.href = '/login';
          }
        }

        // Show user-friendly toast for critical failures
        const friendly = friendlyErrorMessage(fallbackError);
        toast.error(friendly);

        return Promise.reject(fallbackError);
      }
    }

    // Retry logic for transient errors (5xx, timeout)
    if (config && !config._retryCount && (status >= 500 || error?.code === 'ECONNABORTED')) {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= 2) {
        await new Promise(r => setTimeout(r, 1000 * config._retryCount!));
        return api.request(config);
      }
    }

    if (status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/portal')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ─── Bills API (Direct Supabase) ────────────────────────────────
export const billsApi = {
  create: async (bill: { customer_id: string; month: string; amount: number; due_date?: string }) => {
    const { data, error } = await supabaseClient.from("bills").insert(bill).select().single();
    if (error) throw error;
    return data;
  },
  generate: async (month: string) => {
    // Get all active customers who don't have a bill for this month
    const { data: customers } = await supabaseClient
      .from("customers")
      .select("id, monthly_bill, discount, due_date_day")
      .eq("status", "active");
    if (!customers || customers.length === 0) return { generated: 0 };

    const { data: existingBills } = await supabaseClient
      .from("bills")
      .select("customer_id")
      .eq("month", month);
    const existingIds = new Set((existingBills || []).map(b => b.customer_id));

    const newBills = customers
      .filter(c => !existingIds.has(c.id))
      .map(c => {
        const amount = Number(c.monthly_bill || 0) - Number(c.discount || 0);
        const [yr, mn] = month.split("-").map(Number);
        const dueDay = c.due_date_day || 15;
        const dueDate = `${yr}-${String(mn).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
        return { customer_id: c.id, month, amount, due_date: dueDate, status: "unpaid" };
      });

    if (newBills.length > 0) {
      const { error } = await supabaseClient.from("bills").insert(newBills);
      if (error) throw error;
    }
    return { generated: newBills.length };
  },
  update: async (id: string, updates: Record<string, any>) => {
    const { data, error } = await supabaseClient.from("bills").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id: string) => {
    // Clean up related records first
    await supabaseClient.from("merchant_payments").update({ matched_bill_id: null, matched_customer_id: null, status: "unmatched" }).eq("matched_bill_id", id);
    await supabaseClient.from("customer_ledger").delete().eq("reference", `BILL-${id.substring(0, 8)}`);
    const { error } = await supabaseClient.from("bills").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  },
  markPaid: async (id: string) => {
    const { data, error } = await supabaseClient.from("bills").update({ status: "paid", paid_date: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
};

// ─── Payments API (Direct Supabase) ─────────────────────────────
export const paymentsApi = {
  create: async (payment: {
    customer_id: string; amount: number; payment_method: string;
    bill_id?: string; transaction_id?: string; month?: string; status?: string;
  }) => {
    const { data, error } = await supabaseClient.from("payments").insert(payment).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id: string, updates: Record<string, any>) => {
    const { data, error } = await supabaseClient.from("payments").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id: string) => {
    const { error } = await supabaseClient.from("payments").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  },
};

// ─── Merchant Payments API (Direct Supabase) ────────────────────
export const merchantPaymentsApi = {
  create: async (payment: {
    transaction_id: string; sender_phone: string; amount: number;
    reference?: string; payment_date?: string;
  }) => {
    const { data, error } = await supabaseClient.from("merchant_payments").insert(payment).select().single();
    if (error) throw error;
    // Auto-match: find customer by phone
    if (data) {
      const { data: customer } = await supabaseClient
        .from("customers")
        .select("id")
        .or(`phone.eq.${payment.sender_phone},alt_phone.eq.${payment.sender_phone}`)
        .limit(1)
        .maybeSingle();
      if (customer) {
        const { data: unpaidBill } = await supabaseClient
          .from("bills")
          .select("id")
          .eq("customer_id", customer.id)
          .eq("status", "unpaid")
          .order("month", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (unpaidBill) {
          await supabaseClient.from("merchant_payments").update({
            matched_customer_id: customer.id,
            matched_bill_id: unpaidBill.id,
            status: "matched",
          }).eq("id", data.id);
        }
      }
    }
    return data;
  },
  match: async (payment_id: string, bill_id: string, customer_id: string) => {
    const { error: mpError } = await supabaseClient.from("merchant_payments").update({
      matched_bill_id: bill_id,
      matched_customer_id: customer_id,
      status: "matched",
    }).eq("id", payment_id);
    if (mpError) throw mpError;

    // Mark bill as paid
    await supabaseClient.from("bills").update({ status: "paid", paid_date: new Date().toISOString() }).eq("id", bill_id);

    // Get payment amount for creating payment record
    const { data: mp } = await supabaseClient.from("merchant_payments").select("amount, transaction_id").eq("id", payment_id).single();
    if (mp) {
      await supabaseClient.from("payments").insert({
        customer_id, bill_id, amount: mp.amount,
        payment_method: "merchant", transaction_id: mp.transaction_id,
        status: "completed",
      });
      // Update customer ledger (credit)
      const { postCustomerLedgerCredit } = await import("@/lib/ledger");
      await postCustomerLedgerCredit(customer_id, Number(mp.amount), `Payment - Merchant (${mp.transaction_id})`, bill_id);
    }
    return { success: true };
  },
};

// ─── Customers API (Direct Supabase) ────────────────────────────
export const customersApi = {
  create: async (customer: Record<string, any>) => {
    // Auto-generate customer_id (ISP-00001 format) if not provided
    if (!customer.customer_id) {
      const { data: lastCustomer } = await supabaseClient
        .from("customers")
        .select("customer_id")
        .like("customer_id", "ISP-%")
        .order("customer_id", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (lastCustomer?.length) {
        const match = lastCustomer[0].customer_id.match(/ISP-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      customer.customer_id = `ISP-${String(nextNum).padStart(5, "0")}`;
    }

    const { data, error } = await supabaseClient.from("customers").insert(customer as any).select().single();
    if (error) throw error;
    return { customer: data };
  },
};

// ─── Tickets API (Direct Supabase) ──────────────────────────────
export const ticketsApi = {
  create: async (ticket: {
    customer_id: string; subject: string; category?: string;
    priority?: string; message?: string; sender_type?: string; sender_name?: string;
  }) => {
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const { message, sender_type, sender_name, ...ticketData } = ticket;
    const { data, error } = await supabaseClient.from("support_tickets").insert({
      ...ticketData, ticket_id: ticketId,
    }).select().single();
    if (error) throw error;
    // Create first reply from the message
    if (data && message) {
      await supabaseClient.from("ticket_replies").insert({
        ticket_id: data.id,
        sender_type: sender_type || "customer",
        sender_name: sender_name || "Customer",
        message,
      });
    }
    return data;
  },
};

// Customer portal API (uses session token)
export const portalApi = axios.create({
  baseURL: API_BASE_URL + '/portal',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

portalApi.interceptors.request.use((config) => {
  const session = localStorage.getItem('customer_portal_session');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      config.headers['X-Session-Token'] = parsed.session_token;
    } catch {}
  }
  return config;
});

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('customer_portal_session');
      if (window.location.pathname.startsWith('/portal')) {
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(error);
  }
);