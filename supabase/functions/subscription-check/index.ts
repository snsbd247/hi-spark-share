import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    // Find active subscriptions that have expired
    const { data: expiredSubs, error } = await supabase
      .from("tenant_subscriptions")
      .select("id, tenant_id, end_date, status")
      .eq("status", "active")
      .not("end_date", "is", null)
      .lt("end_date", now);

    if (error) throw error;

    let suspendedCount = 0;

    for (const sub of expiredSubs || []) {
      // Mark subscription as expired
      await supabase
        .from("tenant_subscriptions")
        .update({ status: "expired", updated_at: now })
        .eq("id", sub.id);

      // Suspend the tenant
      await supabase
        .from("tenants")
        .update({ status: "suspended", updated_at: now })
        .eq("id", sub.tenant_id);

      // Log the action
      await supabase.from("audit_logs").insert({
        admin_id: "00000000-0000-0000-0000-000000000000",
        admin_name: "System",
        table_name: "tenant_subscriptions",
        action: "subscription_expired",
        record_id: sub.id,
        old_data: { status: "active" },
        new_data: { status: "expired" },
        tenant_id: sub.tenant_id,
      });

      suspendedCount++;
    }

    // Also find tenants with no active subscription at all
    const { data: allTenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("status", "active");

    for (const tenant of allTenants || []) {
      const { data: activeSub } = await supabase
        .from("tenant_subscriptions")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      // If no active sub exists, check if there's any sub at all
      if (!activeSub) {
        const { data: anySub } = await supabase
          .from("tenant_subscriptions")
          .select("id")
          .eq("tenant_id", tenant.id)
          .limit(1)
          .maybeSingle();

        // Only suspend if they had a subscription that expired (not new tenants without subs)
        if (anySub) {
          await supabase
            .from("tenants")
            .update({ status: "suspended", updated_at: now })
            .eq("id", tenant.id)
            .eq("status", "active");
          suspendedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, suspended_tenants: suspendedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
