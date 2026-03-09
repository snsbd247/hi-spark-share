import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Get all active customers
    const { data: customers, error: custErr } = await supabase
      .from("customers")
      .select("id, name, phone, monthly_bill, due_date_day")
      .eq("status", "active");
    if (custErr) throw custErr;

    if (!customers?.length) {
      return new Response(JSON.stringify({ message: "No active customers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check existing bills for this month
    const { data: existing } = await supabase
      .from("bills")
      .select("customer_id")
      .eq("month", month);
    const existingIds = new Set(existing?.map((b: any) => b.customer_id));

    const newBills = customers
      .filter((c: any) => !existingIds.has(c.id))
      .map((c: any) => {
        const dueDay = c.due_date_day || 1;
        const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
        return {
          customer_id: c.id,
          month,
          amount: c.monthly_bill,
          status: "unpaid",
          due_date: dueDate.toISOString().split("T")[0],
        };
      });

    if (!newBills.length) {
      return new Response(JSON.stringify({ message: "All bills already generated", month }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertErr } = await supabase.from("bills").insert(newBills);
    if (insertErr) throw insertErr;

    // Send SMS notifications
    const smsToken = Deno.env.get("GREENWEB_SMS_TOKEN");
    if (smsToken) {
      for (const cust of customers.filter((c: any) => !existingIds.has(c.id))) {
        const dueDay = cust.due_date_day || 1;
        const msg = `Dear ${cust.name}, your internet bill for ${month} is ${cust.monthly_bill} BDT. Please pay before the ${dueDay}th. Thank you.`;
        
        try {
          await fetch("http://api.greenweb.com.bd/api.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: smsToken, to: cust.phone, message: msg }),
          });

          await supabase.from("sms_logs").insert({
            phone: cust.phone,
            message: msg,
            sms_type: "bill_generate",
            customer_id: cust.id,
            status: "sent",
          });
        } catch {
          // SMS failure shouldn't stop the process
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, generated: newBills.length, month }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
