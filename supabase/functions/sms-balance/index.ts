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
    const rawBalance = await balanceRes.json();

    // Strip token from response for security
    const balanceData = Array.isArray(rawBalance)
      ? rawBalance.map(({ token: _t, ...rest }: any) => rest)
      : rawBalance;

    // Fetch sent count from GreenWeb report API (last 30 days)
    let sentCount = 0;
    let failedCount = 0;
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString().split("T")[0];
      const toDate = now.toISOString().split("T")[0];

      // GreenWeb report/log endpoint
      const reportUrl = `http://api.greenweb.com.bd/g_api.php?token=${token}&report&from=${fromDate}&to=${toDate}&json`;
      const reportRes = await fetch(reportUrl);
      const reportText = await reportRes.text();
      
      try {
        const reportData = JSON.parse(reportText);
        if (Array.isArray(reportData)) {
          sentCount = reportData.filter((r: any) => r.status === "sent" || r.status === "delivered" || r.status === "success").length;
          failedCount = reportData.filter((r: any) => r.status === "failed" || r.status === "rejected").length;
          // If no status field, count all as sent
          if (sentCount === 0 && failedCount === 0 && reportData.length > 0) {
            sentCount = reportData.length;
          }
        } else if (reportData && typeof reportData === "object") {
          sentCount = reportData.total_sent || reportData.sent || reportData.count || 0;
          failedCount = reportData.total_failed || reportData.failed || 0;
        }
      } catch {
        // Report endpoint may not be JSON or may not exist
      }
    } catch {
      // Report fetch failed, continue with balance only
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
