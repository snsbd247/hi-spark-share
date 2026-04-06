import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcryptjs from "npm:bcryptjs@2.4.3";

const KNOWN_SUPER_ADMIN_IDENTIFIERS = new Set([
  "admin",
  "superadmin",
  "admin@smartisp.com",
  "superadmin@smartispapp.com",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function findSingleAdminByField(supabase: ReturnType<typeof createClient>, field: "username" | "email", identifier: string) {
  const { data, error } = await supabase
    .from("super_admins")
    .select("*")
    .ilike(field, identifier)
    .limit(2);

  if (error) {
    console.error(`${field} lookup error:`, error.message);
    return null;
  }

  if ((data?.length ?? 0) === 1) {
    return data![0];
  }

  if ((data?.length ?? 0) > 1) {
    console.error(`Multiple super admins matched by ${field}:`, identifier);
  }

  return null;
}

async function resolveSuperAdmin(supabase: ReturnType<typeof createClient>, rawIdentifier: string) {
  const identifier = rawIdentifier.trim();
  const normalized = identifier.toLowerCase();

  const byUsername = await findSingleAdminByField(supabase, "username", identifier);
  if (byUsername) return byUsername;

  const byEmail = await findSingleAdminByField(supabase, "email", identifier);
  if (byEmail) return byEmail;

  if (!KNOWN_SUPER_ADMIN_IDENTIFIERS.has(normalized)) {
    return null;
  }

  const { data, error } = await supabase
    .from("super_admins")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) {
    console.error("Active super admin fallback error:", error.message);
    return null;
  }

  if ((data?.length ?? 0) === 1) {
    console.log("Resolved super admin via fallback alias:", normalized);
    return data![0];
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();
    const identifier = typeof email === "string" ? email.trim() : "";
    console.log("Login attempt for:", identifier);

    if (!identifier || !password) {
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

    const admin = await resolveSuperAdmin(supabase, identifier);

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
    const valid = bcryptjs.compareSync(password, admin.password_hash);
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
