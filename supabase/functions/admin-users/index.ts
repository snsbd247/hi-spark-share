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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  // Verify caller is authenticated admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Check caller has admin/super_admin role
  const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", caller.id);
  const isAdmin = callerRoles?.some((r: any) => r.role === "admin" || r.role === "super_admin");
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // ─── LIST USERS ─────────────────────────────────────────────
    if (req.method === "GET" || (req.method === "POST" && path === "list")) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;

      // Get profiles and roles
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");

      const enriched = users.map((u: any) => {
        const profile = profiles?.find((p: any) => p.id === u.id);
        const userRoleRow = roles?.find((r: any) => r.user_id === u.id);
        const userRoles = roles?.filter((r: any) => r.user_id === u.id).map((r: any) => r.role) || [];
        return {
          id: u.id,
          email: u.email,
          username: profile?.username || "",
          full_name: profile?.full_name || "",
          mobile: profile?.mobile || "",
          staff_id: profile?.staff_id || "",
          address: profile?.address || "",
          avatar_url: profile?.avatar_url || "",
          roles: userRoles,
          custom_role_id: userRoleRow?.custom_role_id || null,
          created_at: u.created_at,
          banned: u.banned_until ? true : false,
          disabled: u.user_metadata?.disabled === true,
        };
      });

      return new Response(JSON.stringify({ users: enriched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── CREATE USER ────────────────────────────────────────────
    if (req.method === "POST" && path === "create") {
      const { email, password, full_name, username, mobile, address, staff_id, role, custom_role_id } = await req.json();

      if (!email || !password || !username) {
        return new Response(JSON.stringify({ error: "Email, username and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check username uniqueness
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Username already taken" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (error) throw error;

      // Hash password with bcrypt
      const password_hash = bcryptjs.hashSync(password, 10);

      // Update profile with username and password_hash
      if (data.user) {
        await supabase.from("profiles").update({
          full_name: full_name || "",
          username: username,
          email: email || null,
          mobile: mobile || null,
          address: address || null,
          staff_id: staff_id || null,
          password_hash: password_hash,
        }).eq("id", data.user.id);

        // Assign role
        if (role) {
          await supabase.from("user_roles").insert({ 
            user_id: data.user.id, 
            role,
            custom_role_id: custom_role_id || null,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, user_id: data.user?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

      // Update auth user
      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (typeof disabled === "boolean") updateData.user_metadata = { disabled };
      if (typeof disabled === "boolean") updateData.ban_duration = disabled ? "876600h" : "none";

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.auth.admin.updateUserById(user_id, updateData);
        if (error) throw error;
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
      await supabase.from("profiles").update(profileUpdate).eq("id", user_id);

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

      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await supabase.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Admin users error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
