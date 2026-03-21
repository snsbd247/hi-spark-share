/**
 * apiDb — Laravel API compatibility layer
 * Provides a Supabase-like query builder interface that calls the Laravel API backend.
 * This ensures all existing components work without modification.
 */
import api from '@/lib/api';

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
  private _offsetCount?: number;
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

  private async _execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const tablePath = this._table.replace(/_/g, '-');

      if (this._operation === "select") {
        const params = this._buildParams();
        const { data: response } = await api.get(`/${tablePath}`, { params });
        let rows = response.data || response;
        if (!Array.isArray(rows)) rows = [rows];

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
    return { data: { session: null }, error: null };
  },
  getUser: async () => {
    const user = localStorage.getItem('admin_user');
    return { data: { user: user ? JSON.parse(user) : null }, error: null };
  },
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const { data } = await api.post('/admin/login', { email, password });
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    return {
      data: { user: data.user, session: { access_token: data.token, user: data.user } },
      error: null,
    };
  },
  signOut: async () => {
    try { await api.post('/admin/logout'); } catch {}
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    return { error: null };
  },
  resetPasswordForEmail: async (email: string) => {
    await api.post('/admin/forgot-password', { email });
    return { data: {}, error: null };
  },
  updateUser: async (updates: any) => {
    const { data } = await api.put('/admin/profile', updates);
    return { data: { user: data }, error: null };
  },
  refreshSession: async () => {
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
    // Check current state immediately
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    if (token && user) {
      setTimeout(() => callback('SIGNED_IN', { access_token: token, user: JSON.parse(user) }), 0);
    }
    // Listen for storage changes (cross-tab)
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

// ─── Mock Storage for compatibility ──────────────────────────────
const storageCompat = {
  from: (bucket: string) => ({
    upload: async (path: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);
      formData.append('path', path);
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
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      return { data: { publicUrl: `${baseUrl}/storage/${bucket}/${path}` } };
    },
    remove: async (paths: string[]) => {
      try {
        await api.post('/storage/delete', { bucket, paths });
        return { data: null, error: null };
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
