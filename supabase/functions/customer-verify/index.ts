import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { session_token, include_profile, include_bills, include_payments, include_ledger } = body;

    if (!session_token) {
      return new Response(
        JSON.stringify({ error: "Session token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up session
    const { data: session, error: sessionError } = await supabase
      .from("customer_sessions")
      .select("customer_id, expires_at")
      .eq("session_token", session_token)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session", valid: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await supabase
        .from("customer_sessions")
        .delete()
        .eq("session_token", session_token);

      return new Response(
        JSON.stringify({ error: "Session expired", valid: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerId = session.customer_id;
    const result: Record<string, any> = { valid: true, customer_id: customerId };

    // Fetch profile if requested
    if (include_profile) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, customer_id, name, phone, area, road, house, city, email, package_id, monthly_bill, ip_address, pppoe_username, onu_mac, router_mac, installation_date, status, username, father_name, mother_name, occupation, nid, alt_phone, permanent_address, gateway, subnet, discount, connectivity_fee, due_date_day, photo_url")
        .eq("id", customerId)
        .single();

      if (!customer) {
        return new Response(
          JSON.stringify({ error: "Customer not found", valid: false }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      result.customer = customer;
    }

    // Fetch bills if requested
    if (include_bills) {
      const { data: bills } = await supabase
        .from("bills")
        .select("*")
        .eq("customer_id", customerId)
        .order("month", { ascending: false });
      result.bills = bills || [];
    }

    // Fetch payments if requested
    if (include_payments) {
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("customer_id", customerId)
        .order("paid_at", { ascending: false });
      result.payments = payments || [];
    }

    // Fetch ledger if requested
    if (include_ledger) {
      const { data: ledger } = await supabase
        .from("customer_ledger")
        .select("*")
        .eq("customer_id", customerId)
        .order("date", { ascending: false });
      result.ledger = ledger || [];
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
