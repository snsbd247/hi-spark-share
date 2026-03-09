import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const todayStr = new Date().toISOString().split("T")[0];

    // Find overdue unpaid bills where due_date has passed
    const { data: overdueBills, error } = await supabase
      .from("bills")
      .select("*, customers(id, name, phone, pppoe_username, router_id, connection_status)")
      .eq("status", "unpaid")
      .lt("due_date", todayStr);

    if (error) throw error;

    let suspended = 0;
    const processed = new Set<string>();

    for (const bill of overdueBills || []) {
      const cust = bill.customers;
      if (!cust || processed.has(cust.id)) continue;
      processed.add(cust.id);

      // Skip already suspended customers
      if (cust.connection_status === "suspended") continue;

      // Suspend via MikroTik if PPPoE credentials exist
      if (cust.pppoe_username && cust.router_id) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/mikrotik-sync/disable-pppoe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pppoe_username: cust.pppoe_username,
              router_id: cust.router_id,
              customer_id: cust.id,
            }),
          });
        } catch (e) {
          console.error(`Failed to suspend ${cust.name} on MikroTik:`, e.message);
          // Still mark as suspended in DB
          await supabase.from("customers").update({
            connection_status: "suspended",
            status: "suspended",
          }).eq("id", cust.id);
        }
      } else {
        // No PPPoE, just update status
        await supabase.from("customers").update({
          connection_status: "suspended",
          status: "suspended",
        }).eq("id", cust.id);
      }

      // Send suspension SMS
      if (cust.phone) {
        await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            to: cust.phone,
            message: `Dear ${cust.name}, your internet service has been suspended due to non-payment. Please pay your outstanding bill to restore service.`,
            sms_type: "suspension",
            customer_id: cust.id,
          }),
        }).catch(() => {});
      }

      // Log the suspension
      await supabase.from("reminder_logs").insert({
        phone: cust.phone || "",
        message: `Auto-suspended: overdue bill for ${bill.month}`,
        channel: "system",
        status: "sent",
        customer_id: cust.id,
        bill_id: bill.id,
      });

      suspended++;
    }

    return new Response(
      JSON.stringify({ success: true, suspended_count: suspended }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
