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

    // Read token from sms_settings table first, fallback to env var
    const { data: settings } = await supabase
      .from("sms_settings")
      .select("api_token")
      .limit(1)
      .single();

    const token = settings?.api_token || Deno.env.get("GREENWEB_SMS_TOKEN") || "";

    if (!token) {
      return new Response(
        JSON.stringify({ error: "SMS API token not configured. Go to SMS Settings to add your GreenWeb API token." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `http://api.greenweb.com.bd/g_api.php?token=${token}&balance&expiry&rate&json`;
    const res = await fetch(url);
    const rawData = await res.json();

    // Strip token from response for security
    const data = Array.isArray(rawData)
      ? rawData.map(({ token: _t, ...rest }: any) => rest)
      : rawData;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
