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

async function dataApiCall(payload: any): Promise<any> {
  let retries = 3;
  let delay = 1000;
  let headers = await getAuthHeaders();

  while (true) {
    try {
      const res = await fetch(`${API_BASE}/data/query`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.status === 401 && retries > 1) {
        const { data: { session } } = await supabase.auth.refreshSession();
        if (session?.access_token) {
          headers = { ...headers, Authorization: `Bearer ${session.access_token}` };
        }
        retries--;
        continue;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `API call failed: ${res.status}`);
      }
      return data;
    } catch (err: any) {
      retries--;
      if (retries <= 0) throw err;
      if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError") || err.message?.includes("network")) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in";

interface QueryFilter {
  column: string;
  op: FilterOp;
  value: any;
}

interface QueryOrder {
  column: string;
  ascending: boolean;
}

class QueryBuilder<T = any> {
  private _table: string;
  private _operation: string = "select";
  private _selectCols: string = "*";
  private _filters: QueryFilter[] = [];
  private _orders: QueryOrder[] = [];
  private _limitCount?: number;
  private _singleRow = false;
  private _maybeSingleRow = false;
  private _data: any = null;
  private _returning?: string;

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = "*") {
    if (this._data !== null) {
      this._returning = columns;
    } else {
      this._operation = "select";
      this._selectCols = columns;
    }
    return this;
  }

  insert(data: any) {
    this._operation = "insert";
    this._data = data;
    return this;
  }

  update(data: any) {
    this._operation = "update";
    this._data = data;
    return this;
  }

  delete() {
    this._operation = "delete";
    return this;
  }

  upsert(data: any) {
    this._operation = "upsert";
    this._data = data;
    return this;
  }

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
      if (this._maybeSingleRow || this._singleRow) {
        return { data: null, error: err };
      }
      return { data: null, error: err };
    }
  }
}

export const apiDb = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  auth: supabase.auth,
  storage: supabase.storage,
  functions: supabase.functions,
  channel: supabase.channel.bind(supabase),
  removeChannel: supabase.removeChannel.bind(supabase),
};

// Named export matching the original supabase import for easy migration
export { apiDb as supabase };
