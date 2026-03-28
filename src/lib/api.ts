import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, IS_LOVABLE_RUNTIME } from '@/lib/apiBaseUrl';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

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
  const table = resource === 'vendors' ? 'suppliers' : resource;
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
  const tableFallbackResources = new Set(['products', 'purchases', 'sales', 'expenses', 'vendors', 'suppliers']);
  if (tableFallbackResources.has(resource)) {
    return handleGenericTableFallback(config, resource, arg1);
  }

  throw new Error(`No fallback route for ${method.toUpperCase()} ${path}`);
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Attach admin auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses + runtime fallback
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;

    if (canUseEdgeFallback && error?.config && (isNetworkError(error) || status === 404)) {
      try {
        return await fallbackRequest(error.config as InternalAxiosRequestConfig);
      } catch (fallbackError: any) {
        if (fallbackError?.status === 401) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/portal')) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(fallbackError);
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

// ─── Bills API ──────────────────────────────────────────────────
export const billsApi = {
  create: (bill: { customer_id: string; month: string; amount: number; due_date?: string }) =>
    api.post('/bills', bill).then(r => r.data),
  generate: (month: string) =>
    api.post('/bills/generate', { month }).then(r => r.data),
  update: (id: string, updates: Record<string, any>) =>
    api.put(`/bills/${id}`, updates).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/bills/${id}`).then(r => r.data),
  markPaid: (id: string) =>
    api.put(`/bills/${id}`, { status: 'paid' }).then(r => r.data),
};

// ─── Payments API ───────────────────────────────────────────────
export const paymentsApi = {
  create: (payment: {
    customer_id: string; amount: number; payment_method: string;
    bill_id?: string; transaction_id?: string; month?: string; status?: string;
  }) => api.post('/payments', payment).then(r => r.data),
  update: (id: string, updates: Record<string, any>) =>
    api.put(`/payments/${id}`, updates).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/payments/${id}`).then(r => r.data),
};

// ─── Merchant Payments API ──────────────────────────────────────
export const merchantPaymentsApi = {
  create: (payment: {
    transaction_id: string; sender_phone: string; amount: number;
    reference?: string; payment_date?: string;
  }) => api.post('/merchant-payments', payment).then(r => r.data),
  match: (payment_id: string, bill_id: string, customer_id: string) =>
    api.post(`/merchant-payments/${payment_id}/match`, { bill_id, customer_id }).then(r => r.data),
};

// ─── Customers API ──────────────────────────────────────────────
export const customersApi = {
  create: (customer: Record<string, any>) =>
    api.post('/customers', customer).then(r => r.data),
};

// ─── Tickets API ────────────────────────────────────────────────
export const ticketsApi = {
  create: (ticket: {
    customer_id: string; subject: string; category?: string;
    priority?: string; message?: string; sender_type?: string; sender_name?: string;
  }) => api.post('/tickets', ticket).then(r => r.data),
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