import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const API_BASE = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api`;

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// ─── Auth Headers with Caching ──────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60_000) {
    return { "Content-Type": "application/json", Authorization: `Bearer ${cachedToken}` };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    cachedToken = session.access_token;
    tokenExpiresAt = (session.expires_at || 0) * 1000;
    return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  }
  return { "Content-Type": "application/json" };
}

async function refreshAndGetHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session?.access_token) {
      cachedToken = session.access_token;
      tokenExpiresAt = (session.expires_at || 0) * 1000;
      return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    cachedToken = null;
    tokenExpiresAt = 0;
  }
  return { "Content-Type": "application/json" };
}

// ─── Error Helpers ──────────────────────────────────────────────
function isNetworkError(msg: string): boolean {
  return ["Failed to fetch", "NetworkError", "network", "ECONNRESET", "ERR_NETWORK", "AbortError"]
    .some(k => msg.includes(k));
}

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 429;
}

// ─── Core API Call ──────────────────────────────────────────────
async function apiCall<T = any>(resource: string, action: string, body: any, skipAuth = false): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers = skipAuth
        ? { "Content-Type": "application/json" }
        : attempt === 0
          ? await getAuthHeaders()
          : await refreshAndGetHeaders();

      const res = await fetch(`${API_BASE}/${resource}/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Auth expired → refresh and retry
      if (res.status === 401 && !skipAuth && attempt < MAX_RETRIES - 1) {
        cachedToken = null;
        tokenExpiresAt = 0;
        lastError = new Error("Session expired");
        continue;
      }

      const data = await res.json();

      if (!res.ok || data.error) {
        const err = new Error(data.error || `API call failed: ${res.status}`);
        if (isRetryableStatus(res.status) && attempt < MAX_RETRIES - 1) {
          lastError = err;
          await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
          continue;
        }
        throw err;
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      const msg = err?.message || "";
      if (isNetworkError(msg) && attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Request failed after retries");
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
    customer_id: string; amount: number; payment_method: string;
    bill_id?: string; transaction_id?: string; month?: string; status?: string;
  }) => apiCall("payments", "create", payment),
  update: (id: string, updates: Record<string, any>) =>
    apiCall("payments", "update", { id, ...updates }),
  delete: (id: string, transaction_id?: string) =>
    apiCall("payments", "delete", { id, transaction_id }),
};

// ─── Merchant Payments API ──────────────────────────────────────
export const merchantPaymentsApi = {
  create: (payment: {
    transaction_id: string; sender_phone: string; amount: number;
    reference?: string; payment_date?: string;
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
    customer_id: string; subject: string; category?: string;
    priority?: string; message?: string; sender_type?: string; sender_name?: string;
  }) => apiCall("tickets", "create", ticket, true),
};
