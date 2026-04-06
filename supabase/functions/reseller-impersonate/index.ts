import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reseller_id, admin_session_token } = await req.json();

    if (!reseller_id || !admin_session_token) {
      return new Response(
        JSON.stringify({ error: "Missing reseller_id or admin_session_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate admin session
    const { data: session } = await supabase
      .from("admin_sessions")
      .select("admin_id")
      .eq("session_token", admin_session_token)
      .eq("status", "active")
      .maybeSingle();

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Invalid admin session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin user's tenant_id (profiles table in Supabase, users in VPS)
    const { data: adminUser } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", session.admin_id)
      .maybeSingle();

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: "Admin user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get reseller — must belong to the same tenant
    const { data: reseller } = await supabase
      .from("resellers")
      .select("*")
      .eq("id", reseller_id)
      .eq("tenant_id", adminUser.tenant_id)
      .maybeSingle();

    if (!reseller) {
      return new Response(
        JSON.stringify({ error: "Reseller not found or cross-tenant access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create reseller session (impersonated)
    const sessionToken = crypto.randomUUID();
    await supabase.from("reseller_sessions").insert({
      reseller_id: reseller.id,
      session_token: sessionToken,
      ip_address: req.headers.get("x-forwarded-for") || "impersonation",
      browser: "Impersonation",
      device_name: `Impersonated by Admin`,
    });

    // Log activity
    await supabase.from("activity_logs").insert({
      action: "impersonate_reseller",
      module: "reseller",
      description: `Admin impersonated reseller: ${reseller.name}`,
      user_id: session.admin_id,
      tenant_id: adminUser.tenant_id,
      metadata: { reseller_id: reseller.id, reseller_name: reseller.name },
    });

    return new Response(
      JSON.stringify({
        user: {
          id: reseller.id,
          name: reseller.name,
          email: reseller.email || "",
          phone: reseller.phone || "",
          company_name: reseller.company_name || "",
          tenant_id: reseller.tenant_id,
          wallet_balance: parseFloat(reseller.wallet_balance) || 0,
          user_id: reseller.user_id || "",
        },
        token: sessionToken,
        impersonated: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
