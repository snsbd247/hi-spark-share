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

    // Fetch balance, expiry, rate
    const balanceUrl = `http://api.greenweb.com.bd/g_api.php?token=${token}&balance&expiry&rate&json`;
    const balanceRes = await fetch(balanceUrl);
    const rawText = await balanceRes.text();
    
    let rawBalance: any;
    try {
      rawBalance = JSON.parse(rawText);
    } catch {
      // If not JSON, try to extract balance from plain text
      return new Response(
        JSON.stringify({ balance: [{ balance: rawText.trim() }], sent_30_days: 0, failed_30_days: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip token from response for security
    const balanceData = Array.isArray(rawBalance)
      ? rawBalance.map(({ token: _t, ...rest }: any) => rest)
      : (typeof rawBalance === 'object' && rawBalance !== null)
        ? (({ token: _t, ...rest }: any) => rest)(rawBalance)
        : rawBalance;

    // Fetch sent/failed count from local sms_logs (accurate source of truth)
    let sentCount = 0;
    let failedCount = 0;
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString();

      const { data: sentData } = await supabase
        .from("sms_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", fromDate);

      const { data: failedData } = await supabase
        .from("sms_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", fromDate);

      // count comes from the response headers when head:true
      const { count: sentC } = await supabase
        .from("sms_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", fromDate);

      const { count: failedC } = await supabase
        .from("sms_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", fromDate);

      sentCount = sentC ?? 0;
      failedCount = failedC ?? 0;
    } catch {
      // DB query failed, continue with balance only
    }

    const result = {
      balance: Array.isArray(balanceData) ? balanceData : [balanceData],
      sent_30_days: sentCount,
      failed_30_days: failedCount,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
