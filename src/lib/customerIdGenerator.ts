import { db } from "@/integrations/supabase/client";

export const DEFAULT_PPPOE_PASSWORD = "123456789";

/**
 * Derive prefix from tenant subdomain (e.g. "snb.smartispapp.com" or "snb" → "SNB").
 * Falls back to "CUS" if no usable value found.
 */
export async function getTenantPrefix(tenantId?: string | null): Promise<string> {
  if (!tenantId) return "CUS";
  try {
    const { data } = await (db as any)
      .from("tenants")
      .select("subdomain, name")
      .eq("id", tenantId)
      .maybeSingle();

    let raw: string = data?.subdomain || data?.name || "";
    raw = String(raw).split(".")[0] || "";
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
    return cleaned || "CUS";
  } catch {
    return "CUS";
  }
}

/**
 * Compute the next sequential customer code for a tenant prefix.
 * Skips numbers already in use.
 */
export async function nextCustomerCode(tenantId?: string | null): Promise<string> {
  const prefix = await getTenantPrefix(tenantId);

  let q: any = (db as any).from("customers").select("customer_id");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  q = q.like("customer_id", `${prefix}%`);
  const { data } = await q;

  let maxNum = 0;
  (data || []).forEach((row: any) => {
    const code: string = row?.customer_id || "";
    const tail = code.slice(prefix.length);
    if (/^\d+$/.test(tail)) {
      const n = parseInt(tail, 10);
      if (n > maxNum) maxNum = n;
    }
  });

  // Loop until unique globally (customer_id has UNIQUE constraint)
  let next = maxNum + 1;
  while (true) {
    const code = `${prefix}${String(next).padStart(6, "0")}`;
    const { data: dup } = await (db as any)
      .from("customers")
      .select("id")
      .eq("customer_id", code)
      .maybeSingle();
    if (!dup) return code;
    next++;
  }
}

/**
 * Apply auto-generation + duplicate validation + default PPPoE password.
 * Throws Error with friendly message on duplicate.
 * Note: pppoe_password_hash is set by backend; in Lovable preview we store
 * the plain pppoe_password and the customer-login edge function auto-hashes on first login.
 */
export async function applyCustomerDefaults(
  payload: Record<string, any>,
  tenantId?: string | null,
  excludeCustomerRowId?: string,
): Promise<Record<string, any>> {
  const out = { ...payload };

  // ── customer_id ──
  let customerId = String(out.customer_id || "").trim();
  if (!customerId) {
    customerId = await nextCustomerCode(tenantId);
  } else {
    let dupQ: any = (db as any).from("customers").select("id").eq("customer_id", customerId);
    if (excludeCustomerRowId) dupQ = dupQ.neq("id", excludeCustomerRowId);
    const { data: dup } = await dupQ.maybeSingle();
    if (dup) {
      throw new Error(`Customer ID "${customerId}" already exists. Use a different one or leave blank to auto-generate.`);
    }
  }
  out.customer_id = customerId;

  // ── pppoe_username (defaults to customer_id) ──
  let pppoe = String(out.pppoe_username || "").trim();
  if (!pppoe) pppoe = customerId;

  let pppoeDupQ: any = (db as any).from("customers").select("id").eq("pppoe_username", pppoe);
  if (excludeCustomerRowId) pppoeDupQ = pppoeDupQ.neq("id", excludeCustomerRowId);
  const { data: pppoeDup } = await pppoeDupQ.maybeSingle();
  if (pppoeDup) {
    throw new Error(`PPPoE username "${pppoe}" already exists. Use a different one or leave blank to auto-generate.`);
  }
  out.pppoe_username = pppoe;

  // ── pppoe_password ──
  if (!String(out.pppoe_password || "").trim()) {
    out.pppoe_password = DEFAULT_PPPOE_PASSWORD;
  }

  return out;
}
