import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");

    // If tenant_id provided — return expiry status for that tenant
    if (tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, name, status, plan_expire_date, grace_days, plan_expiry_message, plan_id")
        .eq("id", tenantId)
        .single();

      if (!tenant) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const now = new Date();
      const expireDate = tenant.plan_expire_date ? new Date(tenant.plan_expire_date) : null;
      const graceDays = tenant.grace_days ?? 3;
      let daysLeft = expireDate ? Math.ceil((expireDate.getTime() - now.getTime()) / 86400000) : null;

      // Get plan info
      let plan = null;
      if (tenant.plan_id) {
        const { data } = await supabase.from("saas_plans").select("*").eq("id", tenant.plan_id).single();
        plan = data;
      }

      return new Response(JSON.stringify({
        tenant_id: tenant.id,
        status: tenant.status,
        plan_expire_date: tenant.plan_expire_date,
        days_left: daysLeft,
        grace_days: graceDays,
        show_warning: daysLeft !== null && daysLeft <= 2 && daysLeft >= -graceDays,
        is_expired: daysLeft !== null && daysLeft < 0,
        is_suspended: tenant.status === "suspended",
        message: tenant.plan_expiry_message || "আপনার প্ল্যানের মেয়াদ শীঘ্রই শেষ হচ্ছে।",
        plan,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Cron mode — check ALL tenants and auto-suspend expired ones
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, name, status, plan_expire_date, grace_days")
      .eq("status", "active");

    const now = new Date();
    let suspended = 0;
    let warned = 0;

    for (const tenant of tenants || []) {
      if (!tenant.plan_expire_date) continue;

      const expireDate = new Date(tenant.plan_expire_date);
      const graceDays = tenant.grace_days ?? 3;
      const graceEnd = new Date(expireDate);
      graceEnd.setDate(graceEnd.getDate() + graceDays);

      const daysLeft = Math.ceil((expireDate.getTime() - now.getTime()) / 86400000);

      if (now > graceEnd) {
        // Auto-suspend
        await supabase.from("tenants").update({ status: "suspended" }).eq("id", tenant.id);

        // Expire active subscriptions
        await supabase.from("subscriptions")
          .update({ status: "expired" })
          .eq("tenant_id", tenant.id)
          .eq("status", "active");

        suspended++;
      } else if (daysLeft <= 2 && daysLeft >= 0) {
        warned++;
      }
    }

    return new Response(JSON.stringify({
      checked: tenants?.length || 0,
      suspended,
      warned,
      timestamp: now.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
