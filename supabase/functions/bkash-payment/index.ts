import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BKASH_BASE_URL = "https://tokenized.pay.bka.sh/v1.2.0-beta";

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

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function handleTestConnection(): Promise<Response> {
  // Load credentials from DB (payment_gateways table)
  const supabase = getSupabaseAdmin();
  const { data: gw, error: gwErr } = await supabase
    .from("payment_gateways")
    .select("app_key, app_secret, username, password, base_url, environment")
    .eq("gateway_name", "bkash")
    .maybeSingle();

  if (gwErr || !gw) {
    return new Response(JSON.stringify({ error: "bKash gateway not configured. Please save settings first." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!gw.app_key || !gw.app_secret || !gw.username || !gw.password) {
    return new Response(JSON.stringify({ error: "Incomplete credentials. Please fill all required fields." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

  if (data.id_token) {
    // Update gateway status
    await supabase
      .from("payment_gateways")
      .update({ status: "connected", last_connected_at: new Date().toISOString() })
      .eq("gateway_name", "bkash");

    return new Response(JSON.stringify({ success: true, message: "Connection successful", token_type: data.token_type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: data.statusMessage || data.msg || "Token grant failed" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

      // Handle action-based routing (from supabase.functions.invoke)
      if (body.action === "test_connection") {
        return await handleTestConnection();
      }

      // Handle path-based routing
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
