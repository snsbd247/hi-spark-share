import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import bcryptjs from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function authenticateCaller(supabase: any, req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");

  // Try Supabase JWT auth first
  if (token.split(".").length === 3) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "super_admin");
      if (isAdmin) return user.id;
    }
  }

  // Fallback: check admin_sessions table (UUID token from custom login)
  const { data: session } = await supabase
    .from("admin_sessions")
    .select("admin_id, status")
    .eq("session_token", token)
    .eq("status", "active")
    .maybeSingle();

  if (session?.admin_id) {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.admin_id);
    const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (isAdmin) return session.admin_id;
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  const callerId = await authenticateCaller(supabase, req);
  if (!callerId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // ─── LIST USERS ─────────────────────────────────────────────
    if (req.method === "GET" || (req.method === "POST" && path === "list")) {
      // Query directly from profiles + user_roles (not auth.admin.listUsers)
      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (profilesErr) throw profilesErr;

      const { data: roles } = await supabase.from("user_roles").select("*");

      const enriched = (profiles || []).map((p: any) => {
        const userRoles = roles?.filter((r: any) => r.user_id === p.id).map((r: any) => r.role) || [];
        const userRoleRow = roles?.find((r: any) => r.user_id === p.id);
        // Only include profiles that have admin roles
        return {
          id: p.id,
          email: p.email || "",
          username: p.username || "",
          full_name: p.full_name || "",
          mobile: p.mobile || "",
          staff_id: p.staff_id || "",
          address: p.address || "",
          avatar_url: p.avatar_url || "",
          roles: userRoles,
          custom_role_id: userRoleRow?.custom_role_id || null,
          created_at: p.created_at,
          disabled: p.status === "disabled",
          banned: p.status === "disabled",
        };
      }).filter((u: any) => u.roles.length > 0); // Only show users with roles assigned

      return new Response(JSON.stringify({ users: enriched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CREATE USER ────────────────────────────────────────────
    if (req.method === "POST" && path === "create") {
      const { email, password, full_name, username, mobile, address, staff_id, role, custom_role_id } = await req.json();

      if (!password || !username) {
        return new Response(JSON.stringify({ error: "Username and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check username uniqueness
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Username already taken" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const password_hash = bcryptjs.hashSync(password, 10);
      const newId = crypto.randomUUID();

      // Create profile directly
      const { error: profileErr } = await supabase.from("profiles").insert({
        id: newId,
        full_name: full_name || "",
        username,
        email: email || null,
        mobile: mobile || null,
        address: address || null,
        staff_id: staff_id || null,
        password_hash,
        status: "active",
      });

      if (profileErr) throw profileErr;

      // Assign role
      if (role) {
        await supabase.from("user_roles").insert({
          user_id: newId,
          role,
          custom_role_id: custom_role_id || null,
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: newId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── UPDATE USER ────────────────────────────────────────────
    if (req.method === "POST" && path === "update") {
      const { user_id, email, password, full_name, username, mobile, address, staff_id, role, disabled, custom_role_id } = await req.json();

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check username uniqueness if provided
      if (username) {
        const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).neq("id", user_id).maybeSingle();
        if (existing) {
          return new Response(JSON.stringify({ error: "Username already taken" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Update profile
      const profileUpdate: any = {
        full_name: full_name || "",
        email: email || null,
        mobile: mobile || null,
        address: address || null,
        staff_id: staff_id || null,
      };
      if (username) profileUpdate.username = username;
      if (password) {
        profileUpdate.password_hash = bcryptjs.hashSync(password, 10);
      }
      if (typeof disabled === "boolean") {
        profileUpdate.status = disabled ? "disabled" : "active";
      }

      const { error: updateErr } = await supabase.from("profiles").update(profileUpdate).eq("id", user_id);
      if (updateErr) throw updateErr;

      // Update role
      if (role) {
        await supabase.from("user_roles").delete().eq("user_id", user_id);
        await supabase.from("user_roles").insert({
          user_id,
          role,
          custom_role_id: custom_role_id || null,
        });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DELETE USER ────────────────────────────────────────────
    if (req.method === "POST" && path === "delete") {
      const { user_id } = await req.json();

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Delete profile (cascades to user_roles, sessions, etc.)
      const { error } = await supabase.from("profiles").delete().eq("id", user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Admin users error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
