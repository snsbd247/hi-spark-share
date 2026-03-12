import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const API_BASE = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api`;

// ─── Tenant ID Management ───────────────────────────────────────
let currentTenantId: string | null = null;

export function setApiTenantId(tenantId: string | null) {
  currentTenantId = tenantId;
}

export function getApiTenantId(): string | null {
  return currentTenantId;
}

// ─── Error Classification ───────────────────────────────────────
type ErrorKind = "network" | "auth" | "permission" | "validation" | "server" | "timeout" | "unknown";

class ApiError extends Error {
  kind: ErrorKind;
  status?: number;
  retryable: boolean;

  constructor(message: string, kind: ErrorKind, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.retryable = kind === "network" || kind === "timeout" || kind === "server";
  }
}

function classifyError(err: any, status?: number): ApiError {
  if (err instanceof ApiError) return err;

  const msg = err?.message || String(err);

  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network") || msg.includes("ECONNRESET") || msg.includes("ERR_NETWORK")) {
    return new ApiError("Network error — check your connection", "network");
  }
  if (msg.includes("AbortError") || msg.includes("timeout") || msg.includes("signal")) {
    return new ApiError("Request timed out", "timeout");
  }
  if (status === 401) return new ApiError("Session expired", "auth", 401);
  if (status === 403) return new ApiError("Insufficient permissions", "permission", 403);
  if (status === 400 || status === 422) return new ApiError(msg, "validation", status);
  if (status && status >= 500) return new ApiError("Server error — try again", "server", status);

  return new ApiError(msg || "Unknown error", "unknown");
}

// ─── Circuit Breaker ────────────────────────────────────────────
const circuitState = { failures: 0, openUntil: 0, threshold: 5, cooldownMs: 30_000 };

function checkCircuit() {
  if (circuitState.failures >= circuitState.threshold) {
    if (Date.now() < circuitState.openUntil) {
      throw new ApiError("Service temporarily unavailable — please wait", "network");
    }
    circuitState.failures = circuitState.threshold - 1;
  }
}

function recordSuccess() { circuitState.failures = 0; }

function recordFailure() {
  circuitState.failures++;
  if (circuitState.failures >= circuitState.threshold) {
    circuitState.openUntil = Date.now() + circuitState.cooldownMs;
    toast.error("Connection issues detected. Retrying automatically...");
  }
}

// ─── Auth Headers with Caching ──────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.access_token) {
    cachedToken = session.access_token;
    tokenExpiresAt = (session.expires_at || 0) * 1000;
  } else {
    cachedToken = null;
    tokenExpiresAt = 0;
  }
});

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

// ─── Core API Call with Full Error Handling ──────────────────────
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function dataApiCall(payload: any): Promise<any> {
  checkCircuit();

  // Inject tenant_id into payload if available
  if (currentTenantId) {
    payload.tenant_id = currentTenantId;
  }

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers = attempt === 0
        ? await getAuthHeaders()
        : await refreshAndGetHeaders();

      const res = await fetch(`${API_BASE}/data/query`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 401 && attempt < MAX_RETRIES - 1) {
        cachedToken = null;
        tokenExpiresAt = 0;
        lastError = classifyError(null, 401);
        continue;
      }

      const data = await res.json();

      if (!res.ok) {
        const err = classifyError(new Error(data.error || `API error ${res.status}`), res.status);
        if (err.retryable && attempt < MAX_RETRIES - 1) {
          lastError = err;
          recordFailure();
          await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
          continue;
        }
        throw err;
      }

      recordSuccess();
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError && !err.retryable) throw err;

      const classified = classifyError(err);
      lastError = classified;

      if (classified.retryable && attempt < MAX_RETRIES - 1) {
        recordFailure();
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
        continue;
      }

      recordFailure();
      throw classified;
    }
  }

  throw lastError || new ApiError("Request failed after retries", "unknown");
}

// ─── Query Builder (Supabase-compatible API) ────────────────────
type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in";

interface QueryFilter { column: string; op: FilterOp; value: any; }
interface QueryOrder { column: string; ascending: boolean; }

class QueryBuilder<T = any> {
  private _table: string;
  private _operation = "select";
  private _selectCols = "*";
  private _filters: QueryFilter[] = [];
  private _orders: QueryOrder[] = [];
  private _limitCount?: number;
  private _singleRow = false;
  private _maybeSingleRow = false;
  private _data: any = null;
  private _returning?: string;

  constructor(table: string) { this._table = table; }

  select(columns = "*") {
    if (this._data !== null) { this._returning = columns; }
    else { this._operation = "select"; this._selectCols = columns; }
    return this;
  }

  insert(data: any) { this._operation = "insert"; this._data = data; return this; }
  update(data: any) { this._operation = "update"; this._data = data; return this; }
  delete() { this._operation = "delete"; return this; }
  upsert(data: any) { this._operation = "upsert"; this._data = data; return this; }

  eq(column: string, value: any) { this._filters.push({ column, op: "eq", value }); return this; }
  neq(column: string, value: any) { this._filters.push({ column, op: "neq", value }); return this; }
  gt(column: string, value: any) { this._filters.push({ column, op: "gt", value }); return this; }
  gte(column: string, value: any) { this._filters.push({ column, op: "gte", value }); return this; }
  lt(column: string, value: any) { this._filters.push({ column, op: "lt", value }); return this; }
  lte(column: string, value: any) { this._filters.push({ column, op: "lte", value }); return this; }
  like(column: string, value: any) { this._filters.push({ column, op: "like", value }); return this; }
  ilike(column: string, value: any) { this._filters.push({ column, op: "ilike", value }); return this; }
  is(column: string, value: any) { this._filters.push({ column, op: "is", value }); return this; }
  or(filterString: string) { this._filters.push({ column: "__or", op: "eq" as FilterOp, value: filterString }); return this; }
  in(column: string, values: any[]) { this._filters.push({ column, op: "in", value: values }); return this; }

  order(column: string, options?: { ascending?: boolean }) {
    this._orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) { this._limitCount = count; return this; }
  single() { this._singleRow = true; return this; }
  maybeSingle() { this._maybeSingleRow = true; return this; }

  then<TResult1 = any, TResult2 = never>(
    resolve?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(resolve, reject);
  }

  private async _execute(): Promise<{ data: any; error: any }> {
    try {
      const result = await dataApiCall({
        table: this._table,
        operation: this._operation,
        select: this._selectCols,
        filters: this._filters,
        order: this._orders,
        limit: this._limitCount,
        single: this._singleRow,
        maybeSingle: this._maybeSingleRow,
        data: this._data,
        returning: this._returning,
      });
      return { data: result.data, error: null };
    } catch (err: any) {
      console.error(`[apiDb] ${this._operation} ${this._table} failed:`, err.message);
      return { data: null, error: err };
    }
  }
}

// ─── Exported Client ────────────────────────────────────────────
export const apiDb = {
  from(table: string) { return new QueryBuilder(table); },
  auth: supabase.auth,
  storage: supabase.storage,
  functions: supabase.functions,
  channel: supabase.channel.bind(supabase),
  removeChannel: supabase.removeChannel.bind(supabase),
};

export { apiDb as supabase };
