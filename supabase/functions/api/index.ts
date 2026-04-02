import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  generateCustomerId,
  generateTicketId,
  createBillLedgerEntry,
  createPaymentLedgerEntry,
  handlePaymentReactivation,
  autoMatchMerchantPayment,
  authenticateRequest,
  hasRole,
} from "../_shared/business-logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Create an accounting transaction entry for merchant payment in the configured receiving account.
 */
async function createMerchantAccountingEntry(supabase: any, amount: number, transactionId: string, description: string) {
  try {
    const { data: setting } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "merchant_payment_account_id")
      .maybeSingle();

    const accountId = setting?.setting_value;
    if (!accountId || accountId === "none") return;

    // Get account type for correct debit/credit posting
    const { data: accInfo } = await supabase.from("accounts").select("balance, type").eq("id", accountId).single();
    const isDebitNormal = accInfo && ["asset", "expense"].includes(accInfo.type);

    // Create transaction record with proper debit/credit
    await supabase.from("transactions").insert({
      account_id: accountId,
      type: "receipt",
      debit: isDebitNormal ? amount : 0,
      credit: isDebitNormal ? 0 : amount,
      description: `Merchant Payment - ${description} (TrxID: ${transactionId})`,
      date: new Date().toISOString(),
      reference: `MERCH-${transactionId}`,
    });

    // Update account balance using fetched account info
    if (accInfo) {
      const balanceChange = isDebitNormal ? amount : amount;
      await supabase.from("accounts").update({ balance: (accInfo.balance || 0) + balanceChange }).eq("id", accountId);
    }
  } catch (err) {
    console.error("Merchant accounting entry failed:", err);
  }
}

// ─── ALLOWED TABLES ─────────────────────────────────────────────
const ALLOWED_TABLES = new Set([
  "customers", "bills", "payments", "merchant_payments", "packages", "zones",
  "profiles", "user_roles", "custom_roles", "permissions", "role_permissions",
  "general_settings", "sms_settings", "payment_gateways", "mikrotik_routers",
  "olts", "onus", "support_tickets", "ticket_replies", "audit_logs",
  "admin_login_logs", "admin_sessions", "sms_logs", "reminder_logs",
  "customer_ledger", "customer_sessions", "sms_templates", "backup_logs",
  "system_settings",
  // HR
  "designations", "employees", "attendance", "loans", "salary_sheets",
  "employee_education", "employee_experience", "employee_emergency_contacts", "employee_salary_structure",
  "employee_provident_fund", "employee_savings_fund",
  // Accounting
  "accounts", "income_heads", "expense_heads", "other_heads", "transactions",
  // Inventory / Purchases
  "products", "purchases", "purchase_items",
  // Supplier
  "suppliers", "supplier_payments",
  // Sales & Expenses
  "sales", "sale_items", "expenses", "daily_reports",
  // New modules
  "notifications", "coupons", "ip_pools", "faqs",
]);

const PUBLIC_READ_TABLES = new Set([
  "packages", "zones", "general_settings", "support_tickets", "ticket_replies",
  "system_settings",
]);

// ─── GENERIC DATA PROXY HANDLER ─────────────────────────────────
async function handleDataProxy(supabase: any, userId: string | null, body: any) {
  const { table, operation, select, filters, order, limit, single, maybeSingle, data, returning } = body;

  if (!table || !ALLOWED_TABLES.has(table)) {
    return jsonResponse({ error: "Table not allowed" }, 403);
  }

  if (!userId) {
    if (operation !== "select" || !PUBLIC_READ_TABLES.has(table)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const writeOps = new Set(["insert", "update", "delete", "upsert"]);
  if (writeOps.has(operation) && userId) {
    const isOwnProfileUpdate = table === "profiles" && operation === "update" &&
      filters?.some((f: any) => f.column === "id" && f.op === "eq" && f.value === userId);

    if (!isOwnProfileUpdate) {
      const isAdmin = await hasRole(supabase, userId, "admin") || await hasRole(supabase, userId, "super_admin");
      if (!isAdmin) {
        return jsonResponse({ error: "Insufficient permissions" }, 403);
      }
    }
  }

  const effectiveFilters = [...(filters || [])];

  if (operation === "select") {
    let query = supabase.from(table).select(select || "*");
    for (const f of effectiveFilters) {
      if (f.column === "__or") query = query.or(f.value);
      else if (f.op === "in") query = query.in(f.column, f.value);
      else if (f.op === "is") query = query.is(f.column, f.value);
      else query = query[f.op](f.column, f.value);
    }
    for (const o of (order || [])) {
      query = query.order(o.column, { ascending: o.ascending });
    }
    if (limit) query = query.limit(limit);

    let result;
    if (single) result = await query.single();
    else if (maybeSingle) result = await query.maybeSingle();
    else result = await query;

    if (result.error) throw result.error;
    return jsonResponse({ data: result.data });
  }

  if (operation === "insert") {
    let query = supabase.from(table).insert(data);
    if (returning) query = query.select(returning);
    else query = query.select();
    const result = single ? await query.single() : await query;
    if (result.error) throw result.error;
    return jsonResponse({ data: result.data });
  }

  if (operation === "update") {
    let query = supabase.from(table).update(data);
    for (const f of effectiveFilters) {
      if (f.column === "__or") query = query.or(f.value);
      else if (f.op === "in") query = query.in(f.column, f.value);
      else query = query[f.op](f.column, f.value);
    }
    if (returning) query = query.select(returning);
    const result = single ? await query.single() : await query;
    if (result.error) throw result.error;
    return jsonResponse({ data: result.data });
  }

  if (operation === "delete") {
    let query = supabase.from(table).delete();
    for (const f of effectiveFilters) {
      if (f.column === "__or") query = query.or(f.value);
      else if (f.op === "in") query = query.in(f.column, f.value);
      else if (f.op === "like") query = query.like(f.column, f.value);
      else query = query[f.op](f.column, f.value);
    }
    const result = await query;
    if (result.error) throw result.error;
    return jsonResponse({ data: result.data });
  }

  if (operation === "upsert") {
    let query = supabase.from(table).upsert(data);
    if (returning) query = query.select(returning);
    const result = single ? await query.single() : await query;
    if (result.error) throw result.error;
    return jsonResponse({ data: result.data });
  }

  return jsonResponse({ error: "Invalid operation" }, 400);
}

// ─── MAIN HANDLER ───────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const resource = pathParts[pathParts.length - 2] || "";
  const action = pathParts[pathParts.length - 1] || "";

  const isPublicTicketCreate = resource === "tickets" && action === "create";
  const isDataProxy = resource === "data";

  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const auth = await authenticateRequest(supabase, authHeader);
    if (!auth.error) userId = auth.userId!;
  }

  if (!isPublicTicketCreate && !isDataProxy && !userId) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    if (isDataProxy) {
      const body = await req.json();
      return await handleDataProxy(supabase, userId, body);
    }

    // ─── BILLS ──────────────────────────────────────────────────
    if (resource === "bills") {
      if (action === "create" && req.method === "POST") {
        const body = await req.json();
        const { customer_id, month, amount, due_date, status = "unpaid" } = body;
        const { data: bill, error } = await supabase
          .from("bills").insert({ customer_id, month, amount, due_date, status }).select().single();
        if (error) throw error;
        await createBillLedgerEntry(supabase, bill);
        return jsonResponse({ success: true, bill });
      }

      if (action === "generate" && req.method === "POST") {
        const { month } = await req.json();
        const { data: customers, error: custErr } = await supabase
          .from("customers").select("id, name, phone, monthly_bill, due_date_day").eq("status", "active");
        if (custErr) throw custErr;
        if (!customers?.length) return jsonResponse({ message: "No active customers", generated: 0 });

        const { data: existing } = await supabase.from("bills").select("customer_id").eq("month", month);
        const existingIds = new Set(existing?.map((b: any) => b.customer_id));

        const newBillData = customers
          .filter((c: any) => !existingIds.has(c.id))
          .map((c: any) => {
            const dueDay = c.due_date_day || 15;
            const monthDate = new Date(month + "-01");
            const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
            return { customer_id: c.id, month, amount: c.monthly_bill, status: "unpaid", due_date: dueDate.toISOString().split("T")[0] };
          });

        if (!newBillData.length) return jsonResponse({ message: "All bills already generated", generated: 0 });

        const { data: insertedBills, error } = await supabase.from("bills").insert(newBillData).select();
        if (error) throw error;

        for (const bill of insertedBills || []) {
          await createBillLedgerEntry(supabase, bill);
        }

        const smsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`;
        for (const cust of customers.filter((c: any) => !existingIds.has(c.id))) {
          fetch(smsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: cust.phone,
              message: `Dear ${cust.name}, your internet bill for ${month} is ${cust.monthly_bill} BDT. Please pay before the due date to avoid service suspension.`,
              sms_type: "bill_generate", customer_id: cust.id,
            }),
          }).catch(() => {});
        }

        return jsonResponse({ success: true, generated: newBillData.length, month });
      }

      if (action === "update" && req.method === "POST") {
        const { id, ...updates } = await req.json();
        const { error } = await supabase.from("bills").update(updates).eq("id", id);
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      if (action === "delete" && req.method === "POST") {
        const { id } = await req.json();
        await supabase.from("merchant_payments").update({ matched_bill_id: null, status: "unmatched" }).eq("matched_bill_id", id);
        await supabase.from("payments").delete().eq("bill_id", id);
        await supabase.from("customer_ledger").delete().like("reference", `BILL-${id.substring(0, 8)}`);
        const { error } = await supabase.from("bills").delete().eq("id", id);
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      if (action === "mark-paid" && req.method === "POST") {
        const { id } = await req.json();
        const { error } = await supabase.from("bills").update({ status: "paid", paid_date: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        return jsonResponse({ success: true });
      }
    }

    // ─── PAYMENTS ───────────────────────────────────────────────
    if (resource === "payments") {
      if (action === "create" && req.method === "POST") {
        const body = await req.json();
        const { data: payment, error } = await supabase.from("payments").insert(body).select().single();
        if (error) throw error;
        await createPaymentLedgerEntry(supabase, payment);
        await handlePaymentReactivation(supabase, payment);
        return jsonResponse({ success: true, payment });
      }

      if (action === "update" && req.method === "POST") {
        const { id, ...updates } = await req.json();
        const { error } = await supabase.from("payments").update(updates).eq("id", id);
        if (error) throw error;
        return jsonResponse({ success: true });
      }

      if (action === "delete" && req.method === "POST") {
        const { id, transaction_id } = await req.json();
        const ref = transaction_id ? `TXN-${transaction_id}` : `PAY-${id.substring(0, 8)}`;
        await supabase.from("customer_ledger").delete().eq("reference", ref);
        const { error } = await supabase.from("payments").delete().eq("id", id);
        if (error) throw error;
        return jsonResponse({ success: true });
      }
    }

    // ─── MERCHANT PAYMENTS ──────────────────────────────────────
    if (resource === "merchant-payments") {
      if (action === "create" && req.method === "POST") {
        const body = await req.json();
        const { data: existing } = await supabase.from("merchant_payments").select("id").eq("transaction_id", body.transaction_id).maybeSingle();
        if (existing) return jsonResponse({ error: "Duplicate Transaction ID" }, 400);

        const insertData: any = {
          transaction_id: body.transaction_id, sender_phone: body.sender_phone, amount: body.amount,
          reference: body.reference || null, payment_date: body.payment_date || new Date().toISOString(),
          sms_text: body.sms_text || null,
        };

        const { data: mp, error } = await supabase.from("merchant_payments").insert(insertData).select().single();
        if (error) throw error;

        const matchResult = await autoMatchMerchantPayment(supabase, mp);
        await supabase.from("merchant_payments").update({
          status: matchResult.status, matched_customer_id: matchResult.matched_customer_id || null,
          matched_bill_id: matchResult.matched_bill_id || null, notes: matchResult.notes || null,
        }).eq("id", mp.id);

        return jsonResponse({ success: true, match_status: matchResult.status });
      }

      if (action === "match" && req.method === "POST") {
        const { payment_id, bill_id, customer_id } = await req.json();
        const { data: bill } = await supabase.from("bills").select("month").eq("id", bill_id).single();
        const { data: mp } = await supabase.from("merchant_payments").select("amount, transaction_id, payment_date").eq("id", payment_id).single();
        if (!bill || !mp) return jsonResponse({ error: "Bill or payment not found" }, 404);

        await supabase.from("bills").update({ status: "paid", paid_date: new Date().toISOString() }).eq("id", bill_id);
        const { data: payment } = await supabase.from("payments").insert({
          customer_id, bill_id, amount: mp.amount, payment_method: "bkash_merchant",
          transaction_id: mp.transaction_id, status: "completed", paid_at: mp.payment_date, month: bill.month,
        }).select().single();

        if (payment) {
          await createPaymentLedgerEntry(supabase, payment);
          await handlePaymentReactivation(supabase, { customer_id, bill_id, status: "completed" });
        }

        await supabase.from("merchant_payments").update({
          status: "matched", matched_customer_id: customer_id,
          matched_bill_id: bill_id, notes: "Manually matched by admin",
        }).eq("id", payment_id);

        // Create accounting transaction if receiving account is configured
        await createMerchantAccountingEntry(supabase, mp.amount, mp.transaction_id, "Manual match");

        return jsonResponse({ success: true });
      }
    }

    // ─── CUSTOMERS ──────────────────────────────────────────────
    if (resource === "customers") {
      if (action === "create" && req.method === "POST") {
        const body = await req.json();
        const customerId = await generateCustomerId(supabase);
        body.customer_id = customerId;
        const { data, error } = await supabase.from("customers").insert(body).select().single();
        if (error) throw error;
        return jsonResponse({ success: true, customer: data });
      }
    }

    // ─── TICKETS ────────────────────────────────────────────────
    if (resource === "tickets") {
      if (action === "create" && req.method === "POST") {
        const body = await req.json();
        const ticketId = await generateTicketId(supabase);
        const insertData: any = {
          customer_id: body.customer_id, subject: body.subject,
          category: body.category || "general", priority: body.priority || "medium", ticket_id: ticketId,
        };

        const { data, error } = await supabase.from("support_tickets").insert(insertData).select().single();
        if (error) throw error;

        if (body.message) {
          await supabase.from("ticket_replies").insert({
            ticket_id: data.id, sender_type: body.sender_type || "customer",
            sender_name: body.sender_name || "Customer", message: body.message,
          });
        }
        return jsonResponse({ success: true, ticket: data });
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (err: any) {
    console.error("API error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
