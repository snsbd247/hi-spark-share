import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcryptjs from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accounts } = await req.json();
    // accounts: [{ user_id, username, password }]

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results = [];
    for (const acc of accounts) {
      const password_hash = bcryptjs.hashSync(acc.password, 10);
      
      // Update profile
      const { error: profileError } = await supabase.from("profiles").update({
        username: acc.username,
        password_hash,
      }).eq("id", acc.user_id);

      // Sync Supabase Auth password
      const { error: authError } = await supabase.auth.admin.updateUserById(acc.user_id, {
        password: acc.password,
      });

      results.push({
        user_id: acc.user_id,
        username: acc.username,
        profileError: profileError?.message || null,
        authError: authError?.message || null,
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
