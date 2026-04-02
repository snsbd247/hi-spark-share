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

    const { to, message, sms_type, customer_id, tenant_id } = await req.json();

    if (!to || !message || !sms_type) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, message, sms_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Load SMS config from sms_settings (Super Admin managed) ──
    const { data: settings, error: settingsErr } = await supabase
      .from("sms_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsErr || !settings) {
      console.error("[SMS] Failed to load settings:", settingsErr?.message);
      return new Response(
        JSON.stringify({ success: false, error: "SMS settings not configured by Super Admin" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = settings.api_token || "";
    if (!token) {
      console.error("[SMS] No API token configured");
      return new Response(
        JSON.stringify({ success: false, error: "SMS API token not configured by Super Admin" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Check if SMS is enabled for this type ──
    const typeFlags: Record<string, string> = {
      bill_generate: "sms_on_bill_generate",
      payment: "sms_on_payment",
      registration: "sms_on_registration",
      suspension: "sms_on_suspension",
      new_customer_bill: "sms_on_new_customer_bill",
    };
    if (typeFlags[sms_type] && !settings[typeFlags[sms_type]]) {
      return new Response(
        JSON.stringify({ success: false, reason: `SMS disabled for ${sms_type}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (["bill_reminder", "due_date", "overdue"].includes(sms_type) && settings.sms_on_reminder === false) {
      return new Response(
        JSON.stringify({ success: false, reason: "SMS disabled for bill reminders" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Calculate SMS units ──
    const isUnicode = /[^\x00-\x7F]/.test(message);
    const msgLen = message.length;
    const smsCount = isUnicode
      ? (msgLen <= 70 ? 1 : Math.ceil(msgLen / 67))
      : (msgLen <= 160 ? 1 : Math.ceil(msgLen / 153));

    // ── Tenant wallet balance check ──
    if (tenant_id) {
      const { data: wallet } = await supabase
        .from("sms_wallets")
        .select("id, balance")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      const currentBalance = wallet?.balance ?? 0;

      if (currentBalance < smsCount) {
        await supabase.from("sms_logs").insert({
          phone: to, message, sms_type, status: "failed",
          response: "Insufficient SMS wallet balance",
          customer_id: customer_id || null,
          tenant_id, sms_count: smsCount,
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: "Insufficient SMS balance. Contact Super Admin to recharge.",
            balance: currentBalance,
            required: smsCount,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Clean phone number (Bangladesh format) ──
    const cleanPhone = to.replace(/[^0-9]/g, "");
    const phone = cleanPhone.startsWith("88") ? cleanPhone : `88${cleanPhone}`;

    // ── REAL API CALL to GreenWeb ──
    const gatewayUrl = "http://api.greenweb.com.bd/api.php";
    let responseText = "";
    let status = "failed";

    try {
      console.log(`[SMS] Sending to ${phone} via GreenWeb API...`);
      const smsUrl = `${gatewayUrl}?token=${encodeURIComponent(token)}&to=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}`;
      const smsResponse = await fetch(smsUrl);
      responseText = await smsResponse.text();
      console.log(`[SMS] GreenWeb raw response: "${responseText}"`);

      // GreenWeb returns "Ok: <number>" on success
      // Any other response = failure
      if (responseText && responseText.trim().toLowerCase().startsWith("ok")) {
        status = "sent";
      } else {
        status = "failed";
        console.error(`[SMS] GreenWeb API returned non-success: "${responseText}"`);
      }
    } catch (e: any) {
      responseText = e.message || "Gateway connection error";
      status = "failed";
      console.error(`[SMS] GreenWeb API exception: ${responseText}`);
    }

    // ── Deduct wallet balance ONLY on confirmed success ──
    if (status === "sent" && tenant_id) {
      const { data: wallet } = await supabase
        .from("sms_wallets")
        .select("id, balance")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (wallet) {
        const newBalance = Math.max(0, wallet.balance - smsCount);
        await supabase
          .from("sms_wallets")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("id", wallet.id);

        await supabase.from("sms_transactions").insert({
          tenant_id,
          amount: smsCount,
          type: "debit",
          description: `SMS to ${to} (${sms_type})`,
          balance_after: newBalance,
        });
      }
    }

    // ── Log with REAL status ──
    await supabase.from("sms_logs").insert({
      phone: to, message, sms_type, status, response: responseText,
      customer_id: customer_id || null,
      tenant_id: tenant_id || null,
      sms_count: smsCount,
    });

    // ── Reminder logs for billing types ──
    if (["bill_generate", "bill_reminder", "due_date", "overdue", "new_customer_bill"].includes(sms_type)) {
      await supabase.from("reminder_logs").insert({
        phone: to, message, channel: "sms", status,
        customer_id: customer_id || null,
      });
    }

    // ── Get updated balance ──
    let remainingBalance = null;
    if (tenant_id) {
      const { data: updatedWallet } = await supabase
        .from("sms_wallets")
        .select("balance")
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      remainingBalance = updatedWallet?.balance ?? null;
    }

    // ── Return REAL result based on API response ──
    const isSuccess = status === "sent";
    console.log(`[SMS] Final result: success=${isSuccess}, status=${status}`);

    return new Response(
      JSON.stringify({
        success: isSuccess,
        status,
        response: responseText,
        remaining_balance: remainingBalance,
        ...(status === "failed" ? { error: `SMS delivery failed: ${responseText}` } : {}),
      }),
      {
        status: isSuccess ? 200 : 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error(`[SMS] Unhandled error: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
