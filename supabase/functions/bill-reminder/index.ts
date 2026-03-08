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

    const { action } = await req.json();

    if (action === "check-reminders") {
      const today = new Date();
      const in5Days = new Date(today);
      in5Days.setDate(today.getDate() + 5);

      const todayStr = today.toISOString().split("T")[0];
      const in5DaysStr = in5Days.toISOString().split("T")[0];

      // Get unpaid bills with due dates
      const { data: bills, error } = await supabase
        .from("bills")
        .select("*, customers(name, phone, id)")
        .eq("status", "unpaid")
        .not("due_date", "is", null);

      if (error) throw error;

      let sent = 0;

      for (const bill of bills || []) {
        if (!bill.customers?.phone) continue;

        const dueDate = bill.due_date;
        let smsType = "";
        let message = "";
        const customerName = bill.customers.name;
        const amount = bill.amount;
        const month = bill.month;
        const payLink = `${supabaseUrl.replace('.supabase.co', '')}/pay/${bill.payment_link_token}`;

        if (dueDate === in5DaysStr) {
          smsType = "bill_reminder";
          message = `Dear ${customerName}, your internet bill of ${amount} BDT for ${month} is due in 5 days. Please pay to avoid service interruption.`;
        } else if (dueDate === todayStr) {
          smsType = "due_date";
          message = `Dear ${customerName}, your internet bill of ${amount} BDT for ${month} is due today. Please pay immediately to avoid service suspension.`;
        } else if (dueDate < todayStr) {
          smsType = "overdue";
          message = `Dear ${customerName}, your internet bill of ${amount} BDT for ${month} is overdue. Your service may be suspended. Please pay immediately.`;
        }

        if (smsType && message) {
          // Send SMS
          await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              to: bill.customers.phone,
              message,
              sms_type: smsType,
              customer_id: bill.customers.id,
            }),
          });
          sent++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, reminders_sent: sent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
