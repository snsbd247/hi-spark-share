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
  const paidAt = new Date().toISOString();

  // 1. Mark invoice paid
  await (db.from as any)("subscription_invoices").update({
    status: "paid",
    paid_date: paidAt,
    payment_method: "manual",
  }).eq("id", invoice.id);

  const { data: invoiceRecord } = await (db.from as any)("subscription_invoices")
    .select("id, subscription_id, tenant_id, plan_id, billing_cycle, amount, total_amount")
    .eq("id", invoice.id)
    .maybeSingle();

  // 2. Get plan details for limits
  const { data: plan } = await (db.from as any)("saas_plans")
    .select("id, slug, name, price_monthly, price_yearly, max_customers, max_users, max_routers")
    .eq("id", invoice.plan_id)
    .single();

  // 3. Calculate new expiry
  const billingCycle = invoiceRecord?.billing_cycle || invoice.billing_cycle || "monthly";
  const today = new Date();
  const newExpiry = new Date(today);
  if (billingCycle === "yearly") {
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);
  } else {
    newExpiry.setMonth(newExpiry.getMonth() + 1);
  }
  const startDate = today.toISOString().split("T")[0];
  const endDate = newExpiry.toISOString().split("T")[0];
  const amount = Number(
    invoiceRecord?.total_amount ??
    invoiceRecord?.amount ??
    (billingCycle === "yearly" ? plan?.price_yearly : plan?.price_monthly) ??
    0
  );

  // 4. Update tenant with plan limits + expiry + active status
  const tenantUpdate: any = {
    plan_expire_date: endDate,
    plan_id: invoice.plan_id,
    status: "active",
  };
  if (plan) {
    tenantUpdate.plan = plan.slug;
    tenantUpdate.max_customers = plan.max_customers;
    tenantUpdate.max_users = plan.max_users;
  }
  await (db.from as any)("tenants").update(tenantUpdate).eq("id", invoice.tenant_id);

  // 5. Canonicalize subscriptions: keep only the paid one active
  await (db.from as any)("subscriptions")
    .update({ status: "expired" })
    .eq("tenant_id", invoice.tenant_id)
    .in("status", ["active", "pending"]);

  let targetSubscriptionId = invoiceRecord?.subscription_id || null;

  if (!targetSubscriptionId) {
    const { data: latestSubscription } = await (db.from as any)("subscriptions")
      .select("id")
      .eq("tenant_id", invoice.tenant_id)
      .eq("plan_id", invoice.plan_id)
      .in("status", ["expired", "pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    targetSubscriptionId = latestSubscription?.id || null;
  }

  if (targetSubscriptionId) {
    await (db.from as any)("subscriptions")
      .update({
        status: "active",
        plan_id: invoice.plan_id,
        billing_cycle: billingCycle,
        start_date: startDate,
        end_date: endDate,
        amount,
      })
      .eq("id", targetSubscriptionId);
  } else {
    await (db.from as any)("subscriptions").insert({
      tenant_id: invoice.tenant_id,
      plan_id: invoice.plan_id,
      billing_cycle: billingCycle,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      amount,
    });
  }
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
