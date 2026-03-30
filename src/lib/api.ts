import axios from 'axios';
import { API_BASE_URL } from '@/lib/apiBaseUrl';
import { apiHealth, friendlyErrorMessage } from '@/lib/apiHealth';
import { toast } from 'sonner';

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
    const config = error?.config as any;
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
        window.location.href = '/admin/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ─── Bills API ──────────────────────────────────────────────────
export const billsApi = {
  create: async (bill: { customer_id: string; month: string; amount: number; due_date?: string }) => {
    const { data } = await api.post('/bills', bill);
    return data;
  },
  generate: async (month: string) => {
    const { data } = await api.post('/bills/generate', { month });
    return data;
  },
  update: async (id: string, updates: Record<string, any>) => {
    const { data } = await api.put(`/bills/${id}`, updates);
    return data;
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/bills/${id}`);
    return data;
  },
  markPaid: async (id: string) => {
    const { data } = await api.put(`/bills/${id}`, { status: 'paid', paid_date: new Date().toISOString() });
    return data;
  },
};

// ─── Payments API ───────────────────────────────────────────────
export const paymentsApi = {
  create: async (payment: {
    customer_id: string; amount: number; payment_method: string;
    bill_id?: string; transaction_id?: string; month?: string; status?: string;
  }) => {
    const { data } = await api.post('/payments', payment);
    return data;
  },
  update: async (id: string, updates: Record<string, any>) => {
    const { data } = await api.put(`/payments/${id}`, updates);
    return data;
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/payments/${id}`);
    return data;
  },
};

// ─── Merchant Payments API ──────────────────────────────────────
export const merchantPaymentsApi = {
  create: async (payment: {
    transaction_id: string; sender_phone: string; amount: number;
    reference?: string; payment_date?: string;
  }) => {
    const { data } = await api.post('/merchant-payments', payment);
    return data;
  },
  match: async (payment_id: string, bill_id: string, customer_id: string) => {
    const { data } = await api.post(`/merchant-payments/${payment_id}/match`, { bill_id, customer_id });
    return data;
  },
};

// ─── Customers API ──────────────────────────────────────────────
export const customersApi = {
  create: async (customer: Record<string, any>) => {
    const { data } = await api.post('/customers', customer);
    return data;
  },
};

// ─── Tickets API ────────────────────────────────────────────────
export const ticketsApi = {
  create: async (ticket: {
    customer_id: string; subject: string; category?: string;
    priority?: string; message?: string; sender_type?: string; sender_name?: string;
  }) => {
    const { data } = await api.post('/support-tickets', ticket);
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
