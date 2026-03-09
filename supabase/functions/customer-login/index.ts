import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcryptjs from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pppoe_username, pppoe_password } = await req.json();

    if (!pppoe_username || !pppoe_password) {
      return new Response(
        JSON.stringify({ error: "PPPoE username and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find customer by pppoe_username — select hash column + needed fields (never return plaintext password)
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, customer_id, name, phone, area, road, house, city, email, package_id, monthly_bill, ip_address, pppoe_username, pppoe_password_hash, onu_mac, router_mac, installation_date, status, username, father_name, mother_name, occupation, nid, alt_phone, permanent_address, gateway, subnet, discount, connectivity_fee, due_date_day, photo_url")
      .eq("pppoe_username", pppoe_username)
      .single();

    if (error || !customer) {
      return new Response(
        JSON.stringify({ error: "Invalid PPPoE username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compare password using bcrypt hash
    const storedHash = customer.pppoe_password_hash;
    if (!storedHash) {
      return new Response(
        JSON.stringify({ error: "Account requires password reset. Please contact support." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const passwordValid = bcryptjs.compareSync(pppoe_password, storedHash);
    if (!passwordValid) {
      return new Response(
        JSON.stringify({ error: "Invalid PPPoE username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow suspended users to login (they can view bills/profile but service is off)
    if (customer.status === "disconnected") {
      return new Response(
        JSON.stringify({ error: "Your account has been disconnected. Please contact support." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a session token
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours

    // Invalidate any existing sessions for this customer
    await supabase
      .from("customer_sessions")
      .delete()
      .eq("customer_id", customer.id);

    // Insert new session
    const { error: sessionError } = await supabase
      .from("customer_sessions")
      .insert({
        customer_id: customer.id,
        session_token: sessionToken,
        expires_at: expiresAt,
      });

    if (sessionError) {
      console.error("Session creation failed:", sessionError);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return ONLY minimal non-sensitive fields + session token
    // Sensitive PII (NID, gateway, subnet, IP, etc.) stays server-side
    const safeCustomer = {
      id: customer.id,
      customer_id: customer.customer_id,
      name: customer.name,
      phone: customer.phone,
      area: customer.area,
      status: customer.status,
      monthly_bill: customer.monthly_bill,
      package_id: customer.package_id,
      photo_url: customer.photo_url,
    };

    return new Response(
      JSON.stringify({ customer: safeCustomer, session_token: sessionToken, expires_at: expiresAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
