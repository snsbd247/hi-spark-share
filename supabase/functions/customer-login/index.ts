import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Use service role to query securely server-side
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find customer by pppoe_username
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, customer_id, name, phone, area, road, house, city, email, package_id, monthly_bill, ip_address, pppoe_username, pppoe_password, onu_mac, router_mac, installation_date, status, username")
      .eq("pppoe_username", pppoe_username)
      .single();

    if (error || !customer) {
      return new Response(
        JSON.stringify({ error: "Invalid PPPoE username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compare password (plain text for now — stored as-is in DB)
    if (customer.pppoe_password !== pppoe_password) {
      return new Response(
        JSON.stringify({ error: "Invalid PPPoE username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (customer.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Your account is not active. Please contact support." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return customer data WITHOUT password
    const { pppoe_password: _, ...safeCustomer } = customer;

    return new Response(
      JSON.stringify({ customer: safeCustomer }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
