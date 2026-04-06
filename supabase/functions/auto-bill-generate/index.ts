import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createBillLedgerEntry } from "../_shared/business-logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Fetch all tenants
    const { data: tenants } = await supabase.from("tenants").select("id").eq("status", "active");
    const tenantIds = tenants?.map((t: any) => t.id) || [null];

    let totalGenerated = 0;
    const errors: string[] = [];

    for (const tenantId of tenantIds) {
      try {
        let query = supabase
          .from("customers")
          .select("id, name, phone, monthly_bill, due_date_day, tenant_id")
          .eq("status", "active");
        if (tenantId) query = query.eq("tenant_id", tenantId);

        const { data: customers, error: custErr } = await query;
        if (custErr) throw custErr;
        if (!customers?.length) continue;

        // Check existing bills for this month
        let existingQuery = supabase.from("bills").select("customer_id").eq("month", month);
        if (tenantId) existingQuery = existingQuery.in("customer_id", customers.map((c: any) => c.id));
        const { data: existing } = await existingQuery;
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

        if (!newBills.length) continue;

        const { data: insertedBills, error: insertErr } = await supabase.from("bills").insert(newBills).select();
        if (insertErr) throw insertErr;

        // Create ledger entries
        for (const bill of insertedBills || []) {
          try {
            await createBillLedgerEntry(supabase, bill);
          } catch (e: any) {
            console.error(`[AutoBill] Ledger entry failed for bill ${bill.id}: ${e.message}`);
          }
        }

        totalGenerated += newBills.length;

        // Send SMS notifications
        const { data: smsSettings } = await supabase
          .from("sms_settings")
          .select("api_token, sms_on_bill_generate")
          .limit(1)
          .maybeSingle();

        const smsToken = smsSettings?.api_token || "";
        if (smsToken && smsSettings?.sms_on_bill_generate !== false) {
          const newCustomers = customers.filter((c: any) => !existingIds.has(c.id));
          // Batch SMS — fire and forget, limit concurrency
          const smsBatch = newCustomers.slice(0, 50).map(async (cust: any) => {
            const dueDay = cust.due_date_day || 1;
            const msg = `Dear ${cust.name}, your internet bill for ${month} is ${cust.monthly_bill} BDT. Please pay before the ${dueDay}th. Thank you.`;
            try {
              const cleanPhone = cust.phone.replace(/[^0-9]/g, "");
              const phone = cleanPhone.startsWith("88") ? cleanPhone : `88${cleanPhone}`;
              const smsUrl = `http://api.greenweb.com.bd/api.php?token=${encodeURIComponent(smsToken)}&to=${encodeURIComponent(phone)}&message=${encodeURIComponent(msg)}`;
              const resp = await fetch(smsUrl);
              const respText = await resp.text();
              const status = respText.trim().toLowerCase().startsWith("ok") ? "sent" : "failed";

              await supabase.from("sms_logs").insert({
                phone: cust.phone, message: msg, sms_type: "bill_generate",
                customer_id: cust.id, tenant_id: tenantId, status, response: respText,
              });
            } catch {
              // SMS failure shouldn't stop the process
            }
          });
          await Promise.allSettled(smsBatch);
        }
      } catch (e: any) {
        errors.push(`Tenant ${tenantId}: ${e.message}`);
        console.error(`[AutoBill] Error for tenant ${tenantId}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated: totalGenerated,
        month,
        ...(errors.length ? { warnings: errors } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`[AutoBill] Unhandled error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
