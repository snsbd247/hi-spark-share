// Shared business logic - database-agnostic operations
// These functions contain all business rules previously in DB triggers

/**
 * Generate next customer ID (ISP-00001 format)
 * Previously: generate_customer_id() trigger
 */
export async function generateCustomerId(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("customers")
    .select("customer_id")
    .order("customer_id", { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data?.length > 0) {
    const lastId = data[0].customer_id;
    const match = lastId.match(/ISP-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return `ISP-${String(nextNum).padStart(5, "0")}`;
}

/**
 * Generate next ticket ID (TKT-00001 format)
 * Previously: generate_ticket_id() trigger
 */
export async function generateTicketId(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("support_tickets")
    .select("ticket_id")
    .order("ticket_id", { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data?.length > 0) {
    const lastId = data[0].ticket_id;
    const match = lastId.match(/TKT-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return `TKT-${String(nextNum).padStart(5, "0")}`;
}

/**
 * Create ledger entry for a new bill (debit)
 * Previously: ledger_on_bill_insert() trigger
 */
export async function createBillLedgerEntry(supabase: any, bill: {
  id: string;
  customer_id: string;
  amount: number;
  month: string;
  created_at: string;
}) {
  const { data: lastEntry } = await supabase
    .from("customer_ledger")
    .select("balance")
    .eq("customer_id", bill.customer_id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const prevBalance = lastEntry?.[0]?.balance ?? 0;

  await supabase.from("customer_ledger").insert({
    customer_id: bill.customer_id,
    date: bill.created_at,
    description: `Monthly Internet Bill (${bill.month})`,
    debit: bill.amount,
    credit: 0,
    balance: prevBalance + bill.amount,
    reference: `BILL-${bill.id.substring(0, 8)}`,
    type: "bill",
  });
}

/**
 * Create ledger entry for a completed payment (credit)
 * Previously: ledger_on_payment_insert() trigger
 */
export async function createPaymentLedgerEntry(supabase: any, payment: {
  id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  transaction_id?: string | null;
  paid_at: string;
  status: string;
}) {
  if (payment.status !== "completed") return;

  const { data: lastEntry } = await supabase
    .from("customer_ledger")
    .select("balance")
    .eq("customer_id", payment.customer_id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const prevBalance = lastEntry?.[0]?.balance ?? 0;
  const reference = payment.transaction_id
    ? `TXN-${payment.transaction_id}`
    : `PAY-${payment.id.substring(0, 8)}`;

  await supabase.from("customer_ledger").insert({
    customer_id: payment.customer_id,
    date: payment.paid_at,
    description: `Payment Received (${payment.payment_method})`,
    debit: 0,
    credit: payment.amount,
    balance: prevBalance - payment.amount,
    reference,
    type: "payment",
  });
}

/**
 * Handle payment reactivation logic
 * Previously: handle_payment_reactivation() trigger
 */
export async function handlePaymentReactivation(supabase: any, payment: {
  customer_id: string;
  bill_id?: string | null;
  status: string;
}) {
  if (payment.status !== "completed") return;

  // Mark the related bill as paid
  if (payment.bill_id) {
    await supabase
      .from("bills")
      .update({ status: "paid", paid_date: new Date().toISOString() })
      .eq("id", payment.bill_id)
      .eq("status", "unpaid");
  }

  // Check if customer is suspended
  const { data: customer } = await supabase
    .from("customers")
    .select("id, connection_status")
    .eq("id", payment.customer_id)
    .single();

  if (!customer || customer.connection_status !== "suspended") return;

  // Count remaining overdue bills
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("bills")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", payment.customer_id)
    .eq("status", "unpaid")
    .lt("due_date", today);

  // If no more overdue bills, mark for reactivation
  if ((count ?? 0) === 0) {
    await supabase
      .from("customers")
      .update({ connection_status: "pending_reactivation", status: "active" })
      .eq("id", payment.customer_id);
  }
}

/**
 * Auto-match merchant payment with customer and bill
 * Previously: auto_match_merchant_payment() trigger
 */
export async function autoMatchMerchantPayment(supabase: any, merchantPayment: {
  id: string;
  reference?: string | null;
  amount: number;
  transaction_id: string;
  sender_phone: string;
  payment_date: string;
}): Promise<{ status: string; matched_customer_id?: string; matched_bill_id?: string; notes?: string }> {
  if (!merchantPayment.reference || merchantPayment.reference.trim() === "") {
    return { status: "unmatched", notes: "No reference/customer ID provided" };
  }

  // Try to find customer by reference (customer_id field)
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("customer_id", merchantPayment.reference.toUpperCase().trim())
    .eq("status", "active")
    .maybeSingle();

  if (!customer) {
    return { status: "unmatched", notes: `No customer found with ID: ${merchantPayment.reference}` };
  }

  // Try to find matching unpaid bill
  const { data: bill } = await supabase
    .from("bills")
    .select("id, month")
    .eq("customer_id", customer.id)
    .eq("status", "unpaid")
    .eq("amount", merchantPayment.amount)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (bill) {
    // Mark bill as paid
    await supabase.from("bills").update({ status: "paid", paid_date: new Date().toISOString() }).eq("id", bill.id);

    // Create payment record
    const { data: payment } = await supabase.from("payments").insert({
      customer_id: customer.id,
      bill_id: bill.id,
      amount: merchantPayment.amount,
      payment_method: "bkash_merchant",
      transaction_id: merchantPayment.transaction_id,
      status: "completed",
      paid_at: merchantPayment.payment_date,
      month: bill.month,
    }).select().single();

    // Create ledger entry for this payment
    if (payment) {
      await createPaymentLedgerEntry(supabase, payment);
      await handlePaymentReactivation(supabase, {
        customer_id: customer.id,
        bill_id: bill.id,
        status: "completed",
      });
    }

    return { status: "matched", matched_customer_id: customer.id, matched_bill_id: bill.id };
  }

  return {
    status: "manual_review",
    matched_customer_id: customer.id,
    notes: `Customer found but no matching unpaid bill for amount ${merchantPayment.amount}`,
  };
}

/**
 * Check if user has a specific role
 * Previously: has_role() database function
 */
export async function hasRole(supabase: any, userId: string, role: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/**
 * Check if user has a specific permission
 * Previously: user_has_permission() database function
 */
export async function userHasPermission(supabase: any, userId: string, module: string, action: string): Promise<boolean> {
  // Super admin always has permission
  if (await hasRole(supabase, userId, "super_admin")) return true;

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("custom_role_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!userRole?.custom_role_id) return false;

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("permissions!inner(module, action)")
    .eq("role_id", userRole.custom_role_id);

  return perms?.some((p: any) => p.permissions.module === module && p.permissions.action === action) ?? false;
}

/**
 * Authenticate a request and return user info
 */
export async function authenticateRequest(supabase: any, authHeader: string | null): Promise<{ userId: string; error?: string } | { userId?: undefined; error: string }> {
  if (!authHeader) return { error: "Unauthorized" };

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: "Unauthorized" };

  return { userId: user.id };
}
