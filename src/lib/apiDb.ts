/**
 * apiDb — Laravel API compatibility layer
 * Provides a Supabase-like query builder interface that calls the Laravel API backend.
 * This ensures all existing components work without modification.
 */
import api from '@/lib/api';
import { API_PUBLIC_ROOT, IS_LOVABLE_RUNTIME } from '@/lib/apiBaseUrl';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

// ─── Query Builder (Supabase-compatible API) ────────────────────
type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in";

interface QueryFilter { column: string; op: FilterOp; value: any; }
interface QueryOrder { column: string; ascending: boolean; }

const isNetworkError = (err: any) => !err?.response && (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK');
const shouldUseEdgeFallback = IS_LOVABLE_RUNTIME;

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

  constructor(table: string) { this._table = table; }

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
    params.paginate = false; // return array, not paginated
    return params;
  }

  private async _executeViaEdgeProxy(): Promise<{ data: any; error: any; count?: number }> {
    const payloadBody = {
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
    };

    const invokeProxy = async (token: string) => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/data/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadBody),
      });

      const responseJson = await res.json().catch(() => null);
      if (!res.ok) {
        const message = responseJson?.error || `Edge function returned ${res.status}`;
        throw new Error(message);
      }

      return responseJson;
    };

    const { data: sessionData } = await supabaseClient.auth.getSession();
    let accessToken = sessionData?.session?.access_token || localStorage.getItem('admin_token') || '';

    if (!accessToken) {
      throw new Error('No active session. Please sign in again.');
    }

    try {
      const response = await invokeProxy(accessToken);
      const payload = response?.data ?? null;

      if (this._operation === 'select') {
        if (this._singleRow || this._maybeSingleRow) {
          return { data: payload || null, error: null };
        }

        const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
        if (this._headMode) return { data: null, error: null, count: rows.length };
        return { data: rows, error: null, count: rows.length };
      }

      return { data: payload, error: null };
    } catch (err: any) {
      const firstMessage = err?.message || 'Edge proxy request failed';
      const mayBeAuthIssue = /unauthorized|401|session/i.test(firstMessage);

      if (mayBeAuthIssue) {
        const { data: refreshed, error: refreshError } = await supabaseClient.auth.refreshSession();
        const refreshedToken = refreshed?.session?.access_token;

        if (!refreshError && refreshedToken) {
          const response = await invokeProxy(refreshedToken);
          const payload = response?.data ?? null;

          if (this._operation === 'select') {
            if (this._singleRow || this._maybeSingleRow) {
              return { data: payload || null, error: null };
            }

            const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
            if (this._headMode) return { data: null, error: null, count: rows.length };
            return { data: rows, error: null, count: rows.length };
          }

          return { data: payload, error: null };
        }
      }

      throw err;
    }
  }

  private async _execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const tablePath = this._table.replace(/_/g, '-');

      if (this._operation === "select") {
        const params = this._buildParams();
        const { data: response } = await api.get(`/${tablePath}`, { params });
        let rows = response.data || response;
        if (!Array.isArray(rows)) rows = [rows];

        if (this._headMode) return { data: null, error: null, count: rows.length };
        if (this._singleRow) return { data: rows[0] || null, error: null };
        if (this._maybeSingleRow) return { data: rows[0] || null, error: null };
        return { data: rows, error: null, count: rows.length };
      }

      if (this._operation === "insert") {
        const { data: response } = await api.post(`/${tablePath}`, this._data);
        return { data: Array.isArray(this._data) ? response : response, error: null };
      }

      if (this._operation === "update") {
        const idFilter = this._filters.find(f => f.column === "id" && f.op === "eq");
        if (idFilter) {
          const { data: response } = await api.put(`/${tablePath}/${idFilter.value}`, this._data);
          return { data: response, error: null };
        }
        // Bulk update: send filters along with data
        const { data: response } = await api.put(`/${tablePath}`, {
          ...this._data,
          _filters: this._filters,
        });
        return { data: response, error: null };
      }

      if (this._operation === "delete") {
        const idFilter = this._filters.find(f => f.column === "id" && f.op === "eq");
        if (idFilter) {
          const { data: response } = await api.delete(`/${tablePath}/${idFilter.value}`);
          return { data: response, error: null };
        }
        return { data: null, error: null };
      }

      if (this._operation === "upsert") {
        const { data: response } = await api.post(`/${tablePath}`, {
          ...this._data,
          _upsert: true,
        });
        return { data: response, error: null };
      }

      return { data: null, error: new Error(`Unknown operation: ${this._operation}`) };
    } catch (err: any) {
      if (shouldUseEdgeFallback && isNetworkError(err)) {
        try {
          return await this._executeViaEdgeProxy();
        } catch (edgeErr: any) {
          console.error(`[apiDb] edge fallback ${this._operation} ${this._table} failed:`, edgeErr.message);
          return { data: null, error: { message: edgeErr.message || 'Network fallback failed' } };
        }
      }

      console.error(`[apiDb] ${this._operation} ${this._table} failed:`, err.message);
      return { data: null, error: { message: err.response?.data?.error || err.message } };
    }
  }
}

// ─── Mock Auth for compatibility ─────────────────────────────────
const authCompat = {
  getSession: async () => {
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
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

    if (shouldUseEdgeFallback) {
      const { data, error } = await supabaseClient.auth.getSession();
      return { data: { session: data.session }, error };
    }

    return { data: { session: null }, error: null };
  },
  getUser: async () => {
    const user = localStorage.getItem('admin_user');
    if (!user && shouldUseEdgeFallback) {
      const { data, error } = await supabaseClient.auth.getUser();
      return { data: { user: data.user }, error };
    }
    return { data: { user: user ? JSON.parse(user) : null }, error: null };
  },
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    if (shouldUseEdgeFallback) {
      const { data: edgeData, error: edgeError } = await supabaseClient.functions.invoke('admin-login', {
        body: { username: email, password },
      });

      if (edgeError || !edgeData?.email || !edgeData?.user_id) {
        return {
          data: { user: null, session: null },
          error: { message: edgeError?.message || edgeData?.error || 'Login failed' },
        };
      }

      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: edgeData.email,
        password,
      });

      if (authError || !authData.session) {
        return { data: { user: null, session: null }, error: { message: authError?.message || 'Login failed' } };
      }

      const [{ data: roleData }, { data: profileData }] = await Promise.all([
        supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', edgeData.user_id)
          .limit(1)
          .maybeSingle(),
        supabaseClient
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', edgeData.user_id)
          .maybeSingle(),
      ]);

      const userPayload = {
        id: edgeData.user_id,
        email: edgeData.email,
        name: profileData?.full_name || edgeData.email,
        role: roleData?.role || 'staff',
        avatar_url: profileData?.avatar_url || null,
      };

      localStorage.setItem('admin_token', authData.session.access_token);
      localStorage.setItem('admin_user', JSON.stringify(userPayload));

      return {
        data: { user: userPayload, session: { access_token: authData.session.access_token, user: userPayload } },
        error: null,
      };
    }

    const { data } = await api.post('/admin/login', { email, password });
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    return {
      data: { user: data.user, session: { access_token: data.token, user: data.user } },
      error: null,
    };
  },
  signOut: async () => {
    if (shouldUseEdgeFallback) {
      await supabaseClient.auth.signOut();
    }
    try { await api.post('/admin/logout'); } catch {}
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    return { error: null };
  },
  resetPasswordForEmail: async (email: string, _options?: any) => {
    if (shouldUseEdgeFallback) {
      return supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    }
    await api.post('/admin/forgot-password', { email });
    return { data: {}, error: null };
  },
  updateUser: async (updates: any) => {
    if (shouldUseEdgeFallback) {
      const { data, error } = await supabaseClient.auth.updateUser(updates);
      return { data: { user: data.user }, error };
    }
    const { data } = await api.put('/admin/profile', updates);
    return { data: { user: data }, error: null };
  },
  refreshSession: async () => {
    if (shouldUseEdgeFallback) {
      return supabaseClient.auth.refreshSession();
    }
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    return {
      data: {
        session: token ? { access_token: token, user: user ? JSON.parse(user) : null } : null,
      },
      error: null,
    };
  },
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    if (shouldUseEdgeFallback) {
      return supabaseClient.auth.onAuthStateChange(callback);
    }

    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    if (token && user) {
      setTimeout(() => callback('SIGNED_IN', { access_token: token, user: JSON.parse(user) }), 0);
    }
    const handler = (e: StorageEvent) => {
      if (e.key === 'admin_token') {
        if (e.newValue) {
          const u = localStorage.getItem('admin_user');
          callback('SIGNED_IN', { access_token: e.newValue, user: u ? JSON.parse(u) : null });
        } else {
          callback('SIGNED_OUT', null);
        }
      }
    };
    window.addEventListener('storage', handler);
    return { data: { subscription: { unsubscribe: () => window.removeEventListener('storage', handler) } } };
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

// ─── Mock Functions for compatibility ────────────────────────────
const functionsCompat = {
  invoke: async (name: string, options?: { body?: any; headers?: Record<string, string> }) => {
    try {
      const { data } = await api.post(`/functions/${name}`, options?.body || {});
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

export { apiDb as supabase };