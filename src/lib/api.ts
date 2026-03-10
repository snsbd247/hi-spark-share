import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const API_BASE = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function apiCall<T = any>(resource: string, action: string, body: any, skipAuth = false): Promise<T> {
  let retries = 3;
  let delay = 1000;

  while (true) {
    try {
      const headers = skipAuth
        ? { "Content-Type": "application/json" }
        : await getAuthHeaders();

      const res = await fetch(`${API_BASE}/${resource}/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      // Handle token expiration with refresh
      if (res.status === 401 && !skipAuth && retries > 1) {
        await supabase.auth.refreshSession();
        retries--;
        continue;
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `API call failed: ${res.status}`);
      }
      return data;
    } catch (err: any) {
      retries--;
      if (retries <= 0) throw err;

      // Retry only on network errors
      if (
        err.message?.includes("Failed to fetch") ||
        err.message?.includes("NetworkError") ||
        err.message?.includes("network") ||
        err.message?.includes("ECONNRESET")
      ) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

// ─── Bills API ──────────────────────────────────────────────────
export const billsApi = {
  create: (bill: { customer_id: string; month: string; amount: number; due_date?: string }) =>
    apiCall("bills", "create", bill),

  generate: (month: string) =>
    apiCall("bills", "generate", { month }),

  update: (id: string, updates: Record<string, any>) =>
    apiCall("bills", "update", { id, ...updates }),

  delete: (id: string) =>
    apiCall("bills", "delete", { id }),

  markPaid: (id: string) =>
    apiCall("bills", "mark-paid", { id }),
};

// ─── Payments API ───────────────────────────────────────────────
export const paymentsApi = {
  create: (payment: {
    customer_id: string;
    amount: number;
    payment_method: string;
    bill_id?: string;
    transaction_id?: string;
    month?: string;
    status?: string;
  }) => apiCall("payments", "create", payment),

  update: (id: string, updates: Record<string, any>) =>
    apiCall("payments", "update", { id, ...updates }),

  delete: (id: string, transaction_id?: string) =>
    apiCall("payments", "delete", { id, transaction_id }),
};

// ─── Merchant Payments API ──────────────────────────────────────
export const merchantPaymentsApi = {
  create: (payment: {
    transaction_id: string;
    sender_phone: string;
    amount: number;
    reference?: string;
    payment_date?: string;
  }) => apiCall("merchant-payments", "create", payment),

  match: (payment_id: string, bill_id: string, customer_id: string) =>
    apiCall("merchant-payments", "match", { payment_id, bill_id, customer_id }),
};

// ─── Customers API ──────────────────────────────────────────────
export const customersApi = {
  create: (customer: Record<string, any>) =>
    apiCall("customers", "create", customer),
};

// ─── Tickets API ────────────────────────────────────────────────
export const ticketsApi = {
  create: (ticket: {
    customer_id: string;
    subject: string;
    category?: string;
    priority?: string;
    message?: string;
    sender_type?: string;
    sender_name?: string;
  }) => apiCall("tickets", "create", ticket, true),
};
