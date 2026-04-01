import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcryptjs from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email/username and password are required" }),
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

    // Try username first, then email
    let admin: any = null;
    const { data: byUsername } = await supabase
      .from("super_admins")
      .select("*")
      .eq("username", email)
      .maybeSingle();

    if (byUsername) {
      admin = byUsername;
    } else {
      const { data: byEmail } = await supabase
        .from("super_admins")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      admin = byEmail;
    }

    if (!admin) {
      console.log("No admin found for:", email);
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
    const valid = bcryptjs.compareSync(password, admin.password_hash);
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
    await supabase.from("super_admin_sessions").insert({
      super_admin_id: admin.id,
      session_token: sessionToken,
      ip_address: req.headers.get("x-forwarded-for") || "0.0.0.0",
      browser: req.headers.get("user-agent") || "Unknown",
      status: "active",
    });

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
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
