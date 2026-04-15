import { db } from "@/integrations/supabase/client";

/**
 * When an invoice is marked as paid, activate the tenant's subscription,
 * extend plan expiry, and update tenant limits from the plan.
 */
export async function activateSubscriptionOnPaid(invoice: {
  id: string;
  tenant_id: string;
  plan_id: string;
  billing_cycle?: string;
}) {
  // 1. Mark invoice paid
  await (db.from as any)("subscription_invoices").update({
    status: "paid",
    paid_date: new Date().toISOString(),
    payment_method: "manual",
  }).eq("id", invoice.id);

  // 2. Get plan details for limits
  const { data: plan } = await (db.from as any)("saas_plans")
    .select("id, name, max_customers, max_users, max_routers")
    .eq("id", invoice.plan_id)
    .single();

  // 3. Calculate new expiry
  const newExpiry = new Date();
  if (invoice.billing_cycle === "yearly") {
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);
  } else {
    newExpiry.setMonth(newExpiry.getMonth() + 1);
  }

  // 4. Update tenant with plan limits + expiry + active status
  const tenantUpdate: any = {
    plan_expire_date: newExpiry.toISOString().split("T")[0],
    plan_id: invoice.plan_id,
    status: "active",
  };
  if (plan) {
    tenantUpdate.max_customers = plan.max_customers;
    tenantUpdate.max_users = plan.max_users;
  }
  await (db.from as any)("tenants").update(tenantUpdate).eq("id", invoice.tenant_id);

  // 5. Activate any pending/expired subscriptions for this tenant
  await (db.from as any)("subscriptions").update({ status: "active" })
    .eq("tenant_id", invoice.tenant_id).in("status", ["expired", "pending"]);
}

/**
 * Check if tenant has reached customer limit.
 * Returns { allowed: boolean, current: number, max: number | null }
 */
export async function checkCustomerLimit(tenantId: string): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const { data: tenant } = await (db.from as any)("tenants")
    .select("max_customers")
    .eq("id", tenantId)
    .single();

  const max = tenant?.max_customers ?? null;
  if (!max) return { allowed: true, current: 0, max: null };

  const { count } = await db
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const current = count || 0;
  return { allowed: current < max, current, max };
}

/**
 * Check if tenant has reached user limit.
 */
export async function checkUserLimit(tenantId: string): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const { data: tenant } = await (db.from as any)("tenants")
    .select("max_users")
    .eq("id", tenantId)
    .single();

  const max = tenant?.max_users ?? null;
  if (!max) return { allowed: true, current: 0, max: null };

  const { count } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const current = count || 0;
  return { allowed: current < max, current, max };
}
