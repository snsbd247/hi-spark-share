import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcryptjs from "npm:bcryptjs@2.4.3";

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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
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

    // Find reseller by email
    const { data: resellerData, error } = await supabase
      .from("resellers")
      .select("*")
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();

    if (error || !resellerData) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials or account suspended" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password server-side
    const valid = resellerData.password_hash
      ? bcryptjs.compareSync(password, resellerData.password_hash)
      : false;

    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create session
    const sessionToken = crypto.randomUUID();
    await supabase.from("reseller_sessions").insert({
      reseller_id: resellerData.id,
      session_token: sessionToken,
      ip_address: req.headers.get("x-forwarded-for") || "web",
      browser: (req.headers.get("user-agent") || "Unknown").slice(0, 100),
      device_name: "Web Browser",
    });

    return new Response(
      JSON.stringify({
        user: {
          id: resellerData.id,
          name: resellerData.name,
          email: resellerData.email || "",
          phone: resellerData.phone || "",
          company_name: resellerData.company_name || "",
          tenant_id: resellerData.tenant_id,
          wallet_balance: parseFloat(resellerData.wallet_balance) || 0,
        },
        token: sessionToken,
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
