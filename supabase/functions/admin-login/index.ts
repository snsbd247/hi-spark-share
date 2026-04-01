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
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
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

    // Find profile by username or email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, password_hash, email, status, full_name, avatar_url")
      .or(`username.eq.${username},email.eq.${username}`)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Invalid username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.status === "disabled") {
      return new Response(
        JSON.stringify({ error: "Your account has been disabled." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.password_hash) {
      return new Response(
        JSON.stringify({ error: "Account requires password setup." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const passwordValid = bcryptjs.compareSync(password, profile.password_hash);
    if (!passwordValid) {
      return new Response(
        JSON.stringify({ error: "Invalid username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user has admin/staff role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, custom_role_id")
      .eq("user_id", profile.id);

    const validRoles = ["super_admin", "admin", "owner", "staff", "manager", "operator", "technician", "accountant"];
    const hasAdminRole = roles?.some((r: any) => validRoles.includes(r.role));

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "You do not have admin access" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a session token
    const sessionToken = crypto.randomUUID();

    // Store session
    const { error: sessionErr } = await supabase.from("admin_sessions").insert({
      admin_id: profile.id,
      session_token: sessionToken,
      ip_address: req.headers.get("x-forwarded-for") || "0.0.0.0",
      browser: req.headers.get("user-agent") || "Unknown",
      device_name: "Web Browser",
      status: "active",
    });

    if (sessionErr) {
      console.error("Session insert error:", JSON.stringify(sessionErr));
      return new Response(
        JSON.stringify({ error: "Failed to create session: " + sessionErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log login
    await supabase.from("admin_login_logs").insert({
      admin_id: profile.id,
      action: "login",
      ip_address: req.headers.get("x-forwarded-for") || "0.0.0.0",
      browser: req.headers.get("user-agent") || "Unknown",
    });

    const userRole = roles?.[0]?.role || "staff";

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          role: userRole,
          avatar_url: profile.avatar_url,
        },
        token: sessionToken,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Admin login error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
