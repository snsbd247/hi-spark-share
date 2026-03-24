import axios from 'axios';
import { API_BASE_URL } from '@/lib/apiBaseUrl';

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

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
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
