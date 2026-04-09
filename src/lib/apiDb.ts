/**
 * apiDb — Laravel API compatibility layer
 * Provides a Supabase-like query builder interface that calls the Laravel API backend.
 * This ensures all existing components work without modification.
 */
import api from '@/lib/api';
import { API_PUBLIC_ROOT } from '@/lib/apiBaseUrl';
import { sessionStore } from '@/lib/sessionStore';

// ─── Query Builder (Supabase-compatible API) ────────────────────
type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in";

interface QueryFilter { column: string; op: FilterOp; value: any; }
interface QueryOrder { column: string; ascending: boolean; }

const handleAuthFailure = () => {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  // Don't redirect if already on a login page or portal/landing
  if (path.includes('/login') || path === '/' || path === '/landing' || path === '/demo-request') return;
  if (path.startsWith('/portal')) return;

  if (path.startsWith('/super')) {
    sessionStore.removeItem('super_admin_token');
    sessionStore.removeItem('super_admin_user');
    window.location.href = '/super/login';
  } else if (path.startsWith('/reseller')) {
    sessionStore.removeItem('reseller_token');
    sessionStore.removeItem('reseller_user');
    window.location.href = '/reseller/login';
  } else {
    sessionStore.removeItem('admin_token');
    sessionStore.removeItem('admin_user');
    window.location.href = '/admin/login';
  }
};

const buildTableApiPath = (table: string, id?: string) => {
  const normalizedTable = table.replace(/^\//, '');
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const prefix = path.startsWith('/super') ? '/super-admin/db' : '';
  return `${prefix}/${normalizedTable}${id ? `/${id}` : ''}`;
};

class QueryBuilder<T = any> {
  private _table: string;
  private _operation = "select";
  private _selectCols = "*";
  private _filters: QueryFilter[] = [];
  private _orders: QueryOrder[] = [];
  private _limitCount?: number;
  private _offsetCount?: number;
  private _singleRow = false;
  private _maybeSingleRow = false;
  private _data: any = null;
  private _returning?: string;
  private _countMode?: string;
  private _headMode = false;

  constructor(table: string) { this._table = table.replace(/-/g, '_'); }

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    if (this._data !== null) { this._returning = columns; }
    else { this._operation = "select"; this._selectCols = columns; }
    if (options?.count) this._countMode = options.count;
    if (options?.head) this._headMode = true;
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
  range(from: number, to: number) { this._offsetCount = from; this._limitCount = to - from + 1; return this; }
  single() { this._singleRow = true; return this; }
  maybeSingle() { this._maybeSingleRow = true; return this; }

  then<TResult1 = any, TResult2 = never>(
    resolve?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(resolve, reject);
  }

  private _buildParams(): Record<string, any> {
    const params: Record<string, any> = {};
    if (this._selectCols && this._selectCols !== "*") params.select = this._selectCols;
    for (const f of this._filters) {
      if (f.column === "__or") { params._or = f.value; continue; }
      if (f.op === "eq") params[f.column] = f.value;
      else if (f.op === "in") params[`${f.column}__in`] = f.value;
      else params[`${f.column}__${f.op}`] = f.value;
    }
    if (this._orders.length > 0) {
      params.sort_by = this._orders[0].column;
      params.sort_dir = this._orders[0].ascending ? 'asc' : 'desc';
    }
    if (this._limitCount) params.per_page = this._limitCount;
    if (this._offsetCount) params.page = Math.floor(this._offsetCount / (this._limitCount || 25)) + 1;
    params.paginate = false;
    return params;
  }

  private async _execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const tablePath = this._table;
      const collectionPath = buildTableApiPath(tablePath);

      if (this._operation === "select") {
        const params = this._buildParams();
        const { data: response } = await api.get(collectionPath, { params });
        let rows: any[];
        if (Array.isArray(response)) {
          rows = response;
        } else if (response?.data && Array.isArray(response.data)) {
          rows = response.data;
        } else if (response?.data) {
          rows = [response.data];
        } else if (response && typeof response === 'object' && !Array.isArray(response)) {
          if (response.current_page !== undefined) {
            rows = response.data || [];
          } else {
            rows = [response];
          }
        } else {
          rows = [];
        }

        const totalCount = response?.total ?? rows.length;

        if (this._headMode) return { data: null, error: null, count: totalCount };
        if (this._singleRow) return { data: rows[0] || null, error: null };
        if (this._maybeSingleRow) return { data: rows[0] || null, error: null };
        return { data: rows, error: null, count: totalCount };
      }

      if (this._operation === "insert") {
        const { data: response } = await api.post(collectionPath, this._data);
        return { data: response, error: null };
      }

      if (this._operation === "update") {
        const idFilter = this._filters.find(f => f.column === "id" && f.op === "eq");
        if (idFilter) {
          const { data: response } = await api.put(buildTableApiPath(tablePath, String(idFilter.value)), this._data);
          return { data: response, error: null };
        }
        // Collection-level update with filters
        const filterParams: Record<string, any> = {};
        for (const f of this._filters) {
          if (f.op === "eq") filterParams[f.column] = f.value;
          else filterParams[`${f.column}__${f.op}`] = f.value;
        }
        const { data: response } = await api.put(collectionPath, {
          ...this._data,
          ...filterParams,
        });
        return { data: response, error: null };
      }

      if (this._operation === "delete") {
        const idFilter = this._filters.find(f => f.column === "id" && f.op === "eq");
        if (idFilter) {
          const { data: response } = await api.delete(buildTableApiPath(tablePath, String(idFilter.value)));
          return { data: response, error: null };
        }
        // Bulk delete with filters (e.g. .delete().neq("id", "xxx") or .eq("tenant_id", "xxx"))
        const params = this._buildParams();
        // Send filters as query params to a DELETE on the collection
        const { data: response } = await api.delete(collectionPath, { params });
        return { data: response, error: null };
      }

      if (this._operation === "upsert") {
        const { data: response } = await api.post(collectionPath, {
          ...this._data,
          _upsert: true,
        });
        return { data: response, error: null };
      }

      return { data: null, error: new Error(`Unknown operation: ${this._operation}`) };
    } catch (err: any) {
      const status = err?.response?.status;
      const responseMessage = err?.response?.data?.message || err?.response?.data?.error;
      if (status === 401) {
        handleAuthFailure();
      }

      console.error(`[apiDb] ${this._operation} ${this._table} failed:`, err.message);
      return {
        data: null,
        error: {
          message: responseMessage || err.message,
          status,
          kind: status === 401 ? 'auth' : undefined,
        },
      };
    }
  }
}

// ─── Auth compatibility (sessionStorage-based) ─────────────────────
const authCompat = {
  getSession: async () => {
    const token = sessionStore.getItem('admin_token');
    const user = sessionStore.getItem('admin_user');
    if (token && user) {
      return {
        data: {
          session: {
            access_token: token,
            user: JSON.parse(user),
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      };
    }
    return { data: { session: null }, error: null };
  },
  getUser: async () => {
    const user = sessionStore.getItem('admin_user');
    return { data: { user: user ? JSON.parse(user) : null }, error: null };
  },
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const { data } = await api.post('/admin/login', { email, password });
    sessionStore.setItem('admin_token', data.token);
    sessionStore.setItem('admin_user', JSON.stringify(data.user));
    return {
      data: { user: data.user, session: { access_token: data.token, user: data.user } },
      error: null,
    };
  },
  signOut: async () => {
    try { await api.post('/admin/logout'); } catch {}
    sessionStore.removeItem('admin_token');
    sessionStore.removeItem('admin_user');
    return { error: null };
  },
  resetPasswordForEmail: async (email: string, _options?: any) => {
    await api.post('/admin/forgot-password', { email });
    return { data: {}, error: null };
  },
  updateUser: async (updates: any) => {
    const payload = { ...updates };
    if (payload.password) {
      payload.new_password = payload.password;
      delete payload.password;
    }
    const { data } = await api.put('/admin/profile', payload);
    return { data: { user: data }, error: null };
  },
  refreshSession: async () => {
    const token = sessionStore.getItem('admin_token');
    const user = sessionStore.getItem('admin_user');
    return {
      data: {
        session: token ? { access_token: token, user: user ? JSON.parse(user) : null } : null,
      },
      error: null,
    };
  },
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    const token = sessionStore.getItem('admin_token');
    const user = sessionStore.getItem('admin_user');
    if (token && user) {
      setTimeout(() => callback('SIGNED_IN', { access_token: token, user: JSON.parse(user) }), 0);
    }
    // sessionStorage doesn't fire storage events across tabs, but keep for compatibility
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

// ─── Storage compatibility (uses Laravel API) ───────────────────
const storageCompat = {
  from: (bucket: string) => ({
    upload: async (path: string, file: File, options?: { upsert?: boolean }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);
      formData.append('path', path);
      if (options?.upsert) formData.append('upsert', 'true');
      try {
        const { data } = await api.post('/storage/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return { data: { path: data.path }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    getPublicUrl: (path: string) => {
      return { data: { publicUrl: `${API_PUBLIC_ROOT}/storage/${bucket}/${path}` } };
    },
    remove: async (paths: string[]) => {
      try {
        await api.post('/storage/delete', { bucket, paths });
        return { data: null, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    list: async (prefix = '', _options?: any) => {
      try {
        const { data } = await api.get('/storage/list', { params: { bucket, prefix } });
        return { data: data || [], error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    download: async (path: string) => {
      try {
        const { data } = await api.get('/storage/download', {
          params: { bucket, path },
          responseType: 'blob',
        });
        return { data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
  }),
};

// ─── Function name → Laravel API route mapping ──────────────────
const functionRouteMap: Record<string, { method: 'get' | 'post'; path: string }> = {
  'admin-login': { method: 'post', path: '/admin/login' },
  'admin-users/list': { method: 'get', path: '/admin-users' },
  'admin-users/create': { method: 'post', path: '/admin-users' },
  'admin-users/update': { method: 'post', path: '/admin-users/update-fn' },
  'admin-users/delete': { method: 'post', path: '/admin-users/delete-fn' },
  'send-sms': { method: 'post', path: '/sms/send' },
  'sms-balance': { method: 'get', path: '/sms/balance' },
  'mikrotik-sync/test-connection': { method: 'post', path: '/mikrotik/test-connection' },
  'mikrotik-sync/sync': { method: 'post', path: '/mikrotik/sync' },
  'mikrotik-sync/sync-all': { method: 'post', path: '/mikrotik/sync-all' },
  'mikrotik-sync/sync-ip-pools': { method: 'post', path: '/mikrotik/sync-ip-pools' },
  'mikrotik-sync/push-ip-pool': { method: 'post', path: '/mikrotik/push-ip-pool' },
  'mikrotik-sync/push-all-ip-pools': { method: 'post', path: '/mikrotik/push-all-ip-pools' },
  'mikrotik-sync/create-pppoe': { method: 'post', path: '/mikrotik/sync' },
  'mikrotik-sync/update-pppoe': { method: 'post', path: '/mikrotik/sync' },
  'mikrotik-sync/disable-pppoe': { method: 'post', path: '/mikrotik/disable-pppoe' },
  'mikrotik-sync/enable-pppoe': { method: 'post', path: '/mikrotik/enable-pppoe' },
  'mikrotik-sync/retry-sync': { method: 'post', path: '/mikrotik/sync' },
  'mikrotik-sync/bulk-sync-packages': { method: 'post', path: '/mikrotik/bulk-sync-packages' },
  'mikrotik-sync/import-users': { method: 'post', path: '/mikrotik/import-users' },
  'mikrotik-sync/import-packages': { method: 'post', path: '/mikrotik/import-packages' },
  'mikrotik-sync/sync-profile': { method: 'post', path: '/mikrotik/sync-profile' },
  'mikrotik-sync/remove-profile': { method: 'post', path: '/mikrotik/remove-profile' },
  'reseller-login': { method: 'post', path: '/reseller/login' },
  'reseller-impersonate': { method: 'post', path: '/reseller/impersonate' },
  'reseller-change-password': { method: 'post', path: '/reseller/change-password' },
  'plan-check': { method: 'post', path: '/super-admin/plan-check' },
  'bkash-payment/create': { method: 'post', path: '/bkash/create-payment' },
  'bkash-payment/execute': { method: 'post', path: '/bkash/query-transaction' },
  'nagad-payment': { method: 'post', path: '/nagad/create-payment' },
  'backup-restore': { method: 'post', path: '/backup-restore' },
  'auto-bill-generate': { method: 'post', path: '/bills/generate' },
  'customer-login': { method: 'post', path: '/portal/login' },
  'customer-verify': { method: 'post', path: '/customer/verify' },
  'send-email': { method: 'post', path: '/email/send' },
  'send-whatsapp': { method: 'post', path: '/whatsapp/send' },
  'bill-reminder': { method: 'post', path: '/bills/send-reminders' },
  'session-expiry': { method: 'post', path: '/admin/cleanup-sessions' },
};

// ─── bKash action → route mapping ───────────────────────────────
const bkashActionMap: Record<string, string> = {
  'test_connection': '/bkash/test-connection',
  'create_payment': '/bkash/create-payment',
  'query_transaction': '/bkash/query-transaction',
  'refund': '/bkash/refund',
};

// ─── Functions compatibility (maps to Laravel API) ──────────────
const functionsCompat = {
  invoke: async (name: string, options?: { body?: any; headers?: Record<string, string> }) => {
    try {
      // Handle bkash-payment with action-based routing
      if (name === 'bkash-payment' && options?.body?.action) {
        const route = bkashActionMap[options.body.action];
        if (route) {
          const { action, ...payload } = options.body;
          const { data } = await api.post(route, payload, { headers: options?.headers });
          return { data, error: null };
        }
      }

      const mapRoute = functionRouteMap[name];
      if (mapRoute) {
        const { data } = mapRoute.method === 'get'
          ? await api.get(mapRoute.path, { params: options?.body, headers: options?.headers })
          : await api.post(mapRoute.path, options?.body || {}, { headers: options?.headers });
        return { data, error: null };
      }
      // Fallback: try as generic endpoint
      const { data } = await api.post(`/${name.replace(/\//g, '-')}`, options?.body || {}, {
        headers: options?.headers,
      });
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.response?.data?.error || err.message } };
    }
  },
};

// ─── Exported Client (Supabase-compatible interface) ─────────────
export const apiDb = {
  from(table: string) { return new QueryBuilder(table); },
  auth: authCompat,
  storage: storageCompat,
  functions: functionsCompat,
  channel: (..._args: any[]) => ({
    on: (..._a: any[]) => ({ subscribe: () => ({}) }),
    subscribe: () => ({}),
  }),
  removeChannel: (..._args: any[]) => {},
};

export { apiDb as db };
