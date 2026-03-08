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

    // Get WhatsApp settings
    const { data: settings } = await supabase.from("sms_settings").select("*").limit(1).single();

    if (!settings?.whatsapp_enabled) {
      return new Response(
        JSON.stringify({ error: "WhatsApp notifications are disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = settings.whatsapp_token;
    const phoneNumberId = settings.whatsapp_phone_id;

    if (!token || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "WhatsApp API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, message, customer_id, bill_id } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number for WhatsApp (needs country code without +)
    const cleanPhone = to.replace(/[^0-9]/g, "");
    const phone = cleanPhone.startsWith("880") ? cleanPhone : `880${cleanPhone}`;

    // WhatsApp Cloud API
    const waResponse = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const waResult = await waResponse.json();
    const status = waResponse.ok ? "sent" : "failed";

    // Log to reminder_logs
    await supabase.from("reminder_logs").insert({
      phone: to,
      message,
      channel: "whatsapp",
      status,
      customer_id: customer_id || null,
      bill_id: bill_id || null,
    });

    return new Response(
      JSON.stringify({ success: waResponse.ok, status, response: waResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
