import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BKASH_BASE_URL = "https://tokenized.pay.bka.sh/v1.2.0-beta";

// Simple in-memory rate limiter (per isolate)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 requests per minute per action

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function logRequest(action: string, status: string, details?: string) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("audit_logs").insert({
      action: `bkash_${action}`,
      admin_id: "00000000-0000-0000-0000-000000000000",
      admin_name: "System",
      table_name: "payment_gateways",
      record_id: "bkash",
      new_data: { status, details, timestamp: new Date().toISOString() },
    });
  } catch (e) {
    console.error("Failed to log request:", e);
  }
}

async function getGatewayConfig() {
  const supabase = getSupabaseAdmin();
  const { data: gw, error } = await supabase
    .from("payment_gateways")
    .select("*")
    .eq("gateway_name", "bkash")
    .maybeSingle();
  if (error || !gw) return null;
  return gw;
}

async function getTokenFromGateway(gw: any): Promise<string> {
  const baseUrl = gw.base_url || BKASH_BASE_URL;
  const res = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username: gw.username,
      password: gw.password,
    },
    body: JSON.stringify({
      app_key: gw.app_key,
      app_secret: gw.app_secret,
    }),
  });
  const data = await res.json();
  if (!data.id_token) throw new Error(data.statusMessage || "Failed to get bKash token");
  return data.id_token;
}

async function getBkashToken(): Promise<string> {
  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username: Deno.env.get("BKASH_USERNAME")!,
      password: Deno.env.get("BKASH_PASSWORD")!,
    },
    body: JSON.stringify({
      app_key: Deno.env.get("BKASH_APP_KEY")!,
      app_secret: Deno.env.get("BKASH_APP_SECRET")!,
    }),
  });
  const data = await res.json();
  if (!data.id_token) throw new Error(data.statusMessage || "Failed to get bKash token");
  return data.id_token;
}

async function handleTestConnection(): Promise<Response> {
  if (!checkRateLimit("test_connection")) {
    await logRequest("test_connection", "rate_limited");
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait before trying again." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const gw = await getGatewayConfig();
  if (!gw) {
    await logRequest("test_connection", "failed", "Gateway not configured");
    return new Response(JSON.stringify({ error: "bKash gateway not configured. Please save settings first." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!gw.app_key || !gw.app_secret || !gw.username || !gw.password) {
    await logRequest("test_connection", "failed", "Incomplete credentials");
    return new Response(JSON.stringify({ error: "Incomplete credentials. Please fill all required fields." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = await getTokenFromGateway(gw);
    const supabase = getSupabaseAdmin();
    await supabase
      .from("payment_gateways")
      .update({ status: "connected", last_connected_at: new Date().toISOString() })
      .eq("gateway_name", "bkash");

    await logRequest("test_connection", "success");
    return new Response(JSON.stringify({ success: true, message: "Connection successful" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    await logRequest("test_connection", "failed", err.message);
    return new Response(JSON.stringify({ error: err.message || "Token grant failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleQueryTransaction(body: any): Promise<Response> {
  if (!checkRateLimit("query_transaction")) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { paymentID } = body;
  if (!paymentID) {
    return new Response(JSON.stringify({ error: "Missing paymentID" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const gw = await getGatewayConfig();
  if (!gw) {
    return new Response(JSON.stringify({ error: "bKash gateway not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = await getTokenFromGateway(gw);
    const baseUrl = gw.base_url || BKASH_BASE_URL;

    const res = await fetch(`${baseUrl}/tokenized/checkout/payment/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        "X-APP-Key": gw.app_key,
      },
      body: JSON.stringify({ paymentID }),
    });

    const data = await res.json();
    await logRequest("query_transaction", data.transactionStatus || "queried", paymentID);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    await logRequest("query_transaction", "error", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleRefund(body: any): Promise<Response> {
  if (!checkRateLimit("refund")) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { paymentID, trxID, amount, reason } = body;
  if (!paymentID || !trxID || !amount) {
    return new Response(JSON.stringify({ error: "Missing required fields: paymentID, trxID, amount" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const gw = await getGatewayConfig();
  if (!gw) {
    return new Response(JSON.stringify({ error: "bKash gateway not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = await getTokenFromGateway(gw);
    const baseUrl = gw.base_url || BKASH_BASE_URL;

    const res = await fetch(`${baseUrl}/tokenized/checkout/payment/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        "X-APP-Key": gw.app_key,
      },
      body: JSON.stringify({
        paymentID,
        trxID,
        amount: amount.toString(),
        reason: reason || "Customer refund",
        sku: "ISP-REFUND",
      }),
    });

    const data = await res.json();
    await logRequest("refund", data.transactionStatus || data.statusMessage || "processed", `${paymentID} - ৳${amount}`);

    // Update payment status if refund successful
    if (data.transactionStatus === "Completed" || data.statusCode === "0000") {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("payments")
        .update({ status: "refunded" })
        .eq("bkash_payment_id", paymentID);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    await logRequest("refund", "error", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleCreate(body: any): Promise<Response> {
  const { bill_id, customer_id, callback_url } = body;

  if (!bill_id || !customer_id) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseAdmin();
  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select("amount, customer_id, status")
    .eq("id", bill_id)
    .single();

  if (billError || !bill) {
    return new Response(JSON.stringify({ error: "Bill not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (bill.customer_id !== customer_id) {
    return new Response(JSON.stringify({ error: "Bill does not belong to this customer" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (bill.status === "paid") {
    return new Response(JSON.stringify({ error: "This bill has already been paid" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const amount = Number(bill.amount);
  const token = await getBkashToken();
  const invoiceNumber = `INV-${Date.now()}`;

  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "X-APP-Key": Deno.env.get("BKASH_APP_KEY")!,
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: customer_id,
      callbackURL: callback_url,
      amount: amount.toString(),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: invoiceNumber,
    }),
  });

  const data = await res.json();

  if (data.bkashURL) {
    await supabase.from("payments").insert({
      customer_id,
      bill_id,
      amount,
      payment_method: "bkash",
      status: "pending",
      bkash_payment_id: data.paymentID,
      month: null,
      transaction_id: invoiceNumber,
    });

    return new Response(JSON.stringify({ bkashURL: data.bkashURL, paymentID: data.paymentID }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: data.statusMessage || "Failed to create payment" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleExecute(body: any): Promise<Response> {
  const { paymentID } = body;

  if (!paymentID) {
    return new Response(JSON.stringify({ error: "Missing paymentID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = await getBkashToken();

  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      "X-APP-Key": Deno.env.get("BKASH_APP_KEY")!,
    },
    body: JSON.stringify({ paymentID }),
  });

  const data = await res.json();
  const supabase = getSupabaseAdmin();

  if (data.statusCode === "0000" && data.transactionStatus === "Completed") {
    const { data: payment } = await supabase
      .from("payments")
      .select("bill_id, customer_id, amount")
      .eq("bkash_payment_id", paymentID)
      .single();

    const bkashAmount = parseFloat(data.amount);
    if (payment && Math.abs(bkashAmount - Number(payment.amount)) > 0.01) {
      await supabase
        .from("payments")
        .update({ status: "failed", bkash_trx_id: data.trxID })
        .eq("bkash_payment_id", paymentID);

      return new Response(JSON.stringify({ error: "Payment amount mismatch. Flagged for review." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("payments")
      .update({
        status: "completed",
        bkash_trx_id: data.trxID,
        transaction_id: data.trxID,
        paid_at: new Date().toISOString(),
      })
      .eq("bkash_payment_id", paymentID);

    if (payment?.bill_id) {
      const { data: bill } = await supabase
        .from("bills")
        .select("month")
        .eq("id", payment.bill_id)
        .single();

      await supabase
        .from("bills")
        .update({ status: "paid", paid_date: new Date().toISOString() })
        .eq("id", payment.bill_id);

      if (bill?.month) {
        await supabase
          .from("payments")
          .update({ month: bill.month })
          .eq("bkash_payment_id", paymentID);
      }
    }

    return new Response(JSON.stringify({ success: true, trxID: data.trxID }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("bkash_payment_id", paymentID);

  return new Response(JSON.stringify({ error: data.statusMessage || "Payment failed" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "POST") {
      const body = await req.json();

      // Action-based routing
      if (body.action === "test_connection") return await handleTestConnection();
      if (body.action === "query_transaction") return await handleQueryTransaction(body);
      if (body.action === "refund") return await handleRefund(body);

      // Path-based routing
      if (path === "create") return await handleCreate(body);
      if (path === "execute") return await handleExecute(body);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bKash payment error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
