import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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
    console.log("Login attempt for:", email);

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email/username and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Try username first, then email
    let admin: any = null;
    const { data: byUsername, error: e1 } = await supabase
      .from("super_admins")
      .select("*")
      .eq("username", email)
      .maybeSingle();

    console.log("Username lookup result:", !!byUsername, "error:", e1?.message);

    if (byUsername) {
      admin = byUsername;
    } else {
      const { data: byEmail, error: e2 } = await supabase
        .from("super_admins")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      console.log("Email lookup result:", !!byEmail, "error:", e2?.message);
      admin = byEmail;
    }

    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check lockout
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const minutes = Math.ceil((new Date(admin.locked_until).getTime() - Date.now()) / 60000);
      return new Response(
        JSON.stringify({ error: `Account locked. Try again in ${minutes} minutes.` }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    console.log("Verifying password, hash prefix:", admin.password_hash?.substring(0, 7));
    const valid = await compare(password, admin.password_hash);
    console.log("Password valid:", valid);

    if (!valid) {
      const attempts = (admin.failed_attempts || 0) + 1;
      const updates: Record<string, unknown> = { failed_attempts: attempts };
      if (attempts >= 5) {
        updates.locked_until = new Date(Date.now() + 15 * 60000).toISOString();
      }
      await supabase.from("super_admins").update(updates).eq("id", admin.id);

      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset failed attempts
    await supabase.from("super_admins").update({
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: req.headers.get("x-forwarded-for") || "0.0.0.0",
    }).eq("id", admin.id);

    // Create session
    const sessionToken = crypto.randomUUID();
    const { error: sessErr } = await supabase.from("super_admin_sessions").insert({
      super_admin_id: admin.id,
      session_token: sessionToken,
      ip_address: req.headers.get("x-forwarded-for") || "0.0.0.0",
      browser: req.headers.get("user-agent") || "Unknown",
      status: "active",
    });

    if (sessErr) {
      console.error("Session insert error:", sessErr.message);
    }

    return new Response(
      JSON.stringify({
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          username: admin.username,
          role: "super_admin",
        },
        token: sessionToken,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("Super admin login error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error: " + String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
