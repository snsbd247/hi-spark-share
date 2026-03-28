import { supabase } from "@/integrations/supabase/client";

interface LedgerEntry {
  description: string;
  account_id?: string;
  debit: number;
  credit: number;
  type: string;
  reference?: string;
  date?: string;
  created_by?: string;
}

// ─── Settings & Account Cache ───────────────────────────────────

const settingsCache = new Map<string, string | null>();
const accountCache = new Map<string, string | null>();

export function clearLedgerSettingsCache() {
  settingsCache.clear();
  accountCache.clear();
}

export async function getLedgerSetting(key: string): Promise<string | null> {
  if (settingsCache.has(key)) return settingsCache.get(key)!;
  const { data } = await (supabase as any).from("system_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  const val = data?.setting_value || null;
  settingsCache.set(key, val);
  return val;
}

export async function findAccountByCode(code: string): Promise<string | null> {
  if (accountCache.has(code)) return accountCache.get(code)!;
  const { data } = await (supabase as any).from("accounts").select("id").eq("code", code).maybeSingle();
  const id = data?.id || null;
  accountCache.set(code, id);
  return id;
}

export async function findAccountByName(name: string): Promise<string | null> {
  const cacheKey = `name:${name}`;
  if (accountCache.has(cacheKey)) return accountCache.get(cacheKey)!;
  const { data } = await (supabase as any).from("accounts").select("id").ilike("name", name).maybeSingle();
  const id = data?.id || null;
  accountCache.set(cacheKey, id);
  return id;
}

// ─── Resolve account: settings → code → name fallback ───────────

async function resolveAccount(settingKey: string, fallbackCode: string, fallbackName: string): Promise<string | undefined> {
  const id = await getLedgerSetting(settingKey)
    || await findAccountByCode(fallbackCode)
    || await findAccountByName(fallbackName);
  return id || undefined;
}

async function resolveCashAccount(settingKey: string, paymentMethod: string): Promise<string | undefined> {
  // Check settings first
  const settingsId = await getLedgerSetting(settingKey);
  if (settingsId) return settingsId;

  // Method-based fallback
  switch (paymentMethod) {
    case "bkash": return await findAccountByCode("1103") || await findAccountByName("bKash") || undefined;
    case "nagad": return await findAccountByCode("1104") || await findAccountByName("Nagad") || undefined;
    case "bank": return await findAccountByCode("1102") || await findAccountByName("Bank Account") || undefined;
    default: return await findAccountByCode("1101") || await findAccountByName("Cash in Hand") || undefined;
  }
}

// ─── Core Ledger Posting ────────────────────────────────────────

/**
 * Post a single transaction entry and update account balance.
 */
export async function postToLedger(entry: LedgerEntry) {
  const { error } = await (supabase as any).from("transactions").insert({
    description: entry.description,
    account_id: entry.account_id || null,
    debit: entry.debit,
    credit: entry.credit,
    type: entry.type,
    reference: entry.reference || null,
    date: entry.date || new Date().toISOString(),
    created_by: entry.created_by || null,
  });
  if (error) console.error("Ledger post error:", error);

  // Update account running balance
  if (entry.account_id) {
    const { data: account } = await (supabase as any).from("accounts").select("balance, type").eq("id", entry.account_id).maybeSingle();
    if (account) {
      const isDebitNormal = ["asset", "expense"].includes(account.type);
      const netChange = isDebitNormal
        ? entry.debit - entry.credit
        : entry.credit - entry.debit;
      await (supabase as any).from("accounts").update({
        balance: Number(account.balance) + netChange,
      }).eq("id", entry.account_id);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// DOUBLE-ENTRY POSTING FUNCTIONS
// Every transaction creates TWO entries: Debit & Credit
// Assets/Expenses increase with Debit
// Liabilities/Income/Equity increase with Credit
// ═══════════════════════════════════════════════════════════════

/**
 * ─── SALE ────────────────────────────────────────────────────
 * When a sale happens:
 *   Dr. Cash/Bank (asset)     ← paid amount
 *   Dr. Accounts Receivable   ← unpaid amount (if partial)
 *   Cr. Sales Income (income) ← total amount
 */
export async function postSaleToLedger(
  saleNo: string, total: number, paidAmount: number,
  paymentMethod: string, date: string
) {
  const salesIncomeId = await resolveAccount("sales_income_account", "4100", "Sales Income");
  const cashId = await resolveCashAccount("sales_cash_account", paymentMethod);
  const arId = await findAccountByCode("1200") || await findAccountByName("Accounts Receivable") || undefined;

  // Cr. Sales Income (full total)
  if (total > 0 && salesIncomeId) {
    await postToLedger({
      description: `Sale ${saleNo}`,
      account_id: salesIncomeId,
      debit: 0,
      credit: total,
      type: "sale",
      reference: saleNo,
      date,
    });
  }

  // Dr. Cash/Bank (paid amount)
  if (paidAmount > 0 && cashId) {
    await postToLedger({
      description: `Payment received - ${saleNo}`,
      account_id: cashId,
      debit: paidAmount,
      credit: 0,
      type: "sale",
      reference: saleNo,
      date,
    });
  }

  // Dr. Accounts Receivable (unpaid portion)
  const unpaid = total - paidAmount;
  if (unpaid > 0 && arId) {
    await postToLedger({
      description: `Receivable - ${saleNo}`,
      account_id: arId,
      debit: unpaid,
      credit: 0,
      type: "sale",
      reference: saleNo,
      date,
    });
  }
}

/**
 * ─── SALE PAYMENT ADJUSTMENT ─────────────────────────────────
 * When payment is received against a sale:
 *   Dr. Cash/Bank
 *   Cr. Accounts Receivable
 */
export async function postSalePaymentToLedger(
  saleNo: string, amount: number, paymentMethod: string, date: string
) {
  const cashId = await resolveCashAccount("sales_cash_account", paymentMethod);
  const arId = await findAccountByCode("1200") || await findAccountByName("Accounts Receivable") || undefined;

  if (amount > 0 && cashId) {
    await postToLedger({
      description: `Payment received - ${saleNo}`,
      account_id: cashId,
      debit: amount,
      credit: 0,
      type: "receipt",
      reference: saleNo,
      date,
    });
  }

  if (amount > 0 && arId) {
    await postToLedger({
      description: `Receivable cleared - ${saleNo}`,
      account_id: arId,
      debit: 0,
      credit: amount,
      type: "receipt",
      reference: saleNo,
      date,
    });
  }
}

/**
 * ─── PURCHASE ────────────────────────────────────────────────
 * When a purchase happens:
 *   Dr. COGS / Inventory (expense/asset) ← total
 *   Cr. Cash/Bank (asset)                ← paid amount
 *   Cr. Accounts Payable (liability)     ← unpaid amount
 */
export async function postPurchaseToLedger(
  purchaseNo: string, total: number, paidAmount: number, date: string
) {
  const cogsId = await resolveAccount("purchase_expense_account", "5100", "Cost of Goods Sold");
  const cashId = await resolveAccount("purchase_cash_account", "1101", "Cash in Hand");
  const payableId = await findAccountByCode("2101") || await findAccountByName("Accounts Payable") || undefined;

  // Dr. COGS / Purchase Expense
  if (total > 0 && cogsId) {
    await postToLedger({
      description: `Purchase ${purchaseNo}`,
      account_id: cogsId,
      debit: total,
      credit: 0,
      type: "purchase",
      reference: purchaseNo,
      date,
    });
  }

  // Cr. Cash/Bank (paid amount)
  if (paidAmount > 0 && cashId) {
    await postToLedger({
      description: `Payment for ${purchaseNo}`,
      account_id: cashId,
      debit: 0,
      credit: paidAmount,
      type: "purchase",
      reference: purchaseNo,
      date,
    });
  }

  // Cr. Accounts Payable (unpaid)
  const unpaid = total - paidAmount;
  if (unpaid > 0 && payableId) {
    await postToLedger({
      description: `Payable - ${purchaseNo}`,
      account_id: payableId,
      debit: 0,
      credit: unpaid,
      type: "purchase",
      reference: purchaseNo,
      date,
    });
  }
}

/**
 * ─── PURCHASE PAYMENT ADJUSTMENT ─────────────────────────────
 * When payment is made against a purchase:
 *   Dr. Accounts Payable
 *   Cr. Cash/Bank
 */
export async function postPurchasePaymentToLedger(
  purchaseNo: string, amount: number, paymentMethod: string, date: string
) {
  const cashId = await resolveCashAccount("purchase_cash_account", paymentMethod);
  const payableId = await findAccountByCode("2101") || await findAccountByName("Accounts Payable") || undefined;

  if (amount > 0 && payableId) {
    await postToLedger({
      description: `Payment for ${purchaseNo}`,
      account_id: payableId,
      debit: amount,
      credit: 0,
      type: "payment",
      reference: purchaseNo,
      date,
    });
  }

  if (amount > 0 && cashId) {
    await postToLedger({
      description: `Cash paid - ${purchaseNo}`,
      account_id: cashId,
      debit: 0,
      credit: amount,
      type: "payment",
      reference: purchaseNo,
      date,
    });
  }
}

/**
 * ─── CUSTOMER BILL PAYMENT ──────────────────────────────────
 * ISP bill payment from customer:
 *   Dr. Cash/bKash/Nagad/Bank (asset)
 *   Cr. Service Income (income)
 */
export async function postPaymentToLedger(
  customerName: string, amount: number, method: string, trxId?: string, date?: string
) {
  const cashId = await resolveCashAccount("sales_cash_account", method);
  const serviceIncomeId = await resolveAccount("service_income_account", "4201", "Internet Service Revenue");

  const txDate = date || new Date().toISOString();
  const ref = trxId || `payment-${method}`;

  // Dr. Cash/Bank
  if (amount > 0 && cashId) {
    await postToLedger({
      description: `Bill payment - ${customerName} via ${method}${trxId ? ` (${trxId})` : ""}`,
      account_id: cashId,
      debit: amount,
      credit: 0,
      type: "receipt",
      reference: ref,
      date: txDate,
    });
  }

  // Cr. Service Income
  if (amount > 0 && serviceIncomeId) {
    await postToLedger({
      description: `Service income - ${customerName}`,
      account_id: serviceIncomeId,
      debit: 0,
      credit: amount,
      type: "receipt",
      reference: ref,
      date: txDate,
    });
  }
}

/**
 * ─── BILL GENERATION (Accrual) ──────────────────────────────
 * When a bill is generated:
 *   Dr. Accounts Receivable
 *   Cr. Service Income (accrual)
 */
export async function postBillToLedger(
  customerName: string, amount: number, month: string, date?: string
) {
  const arId = await findAccountByCode("1200") || await findAccountByName("Accounts Receivable") || undefined;
  const serviceIncomeId = await resolveAccount("service_income_account", "4201", "Internet Service Revenue");
  const txDate = date || new Date().toISOString();

  // Dr. Accounts Receivable
  if (amount > 0 && arId) {
    await postToLedger({
      description: `Bill - ${customerName} (${month})`,
      account_id: arId,
      debit: amount,
      credit: 0,
      type: "journal",
      reference: `bill-${month}`,
      date: txDate,
    });
  }

  // Cr. Service Income
  if (amount > 0 && serviceIncomeId) {
    await postToLedger({
      description: `Service accrual - ${customerName} (${month})`,
      account_id: serviceIncomeId,
      debit: 0,
      credit: amount,
      type: "journal",
      reference: `bill-${month}`,
      date: txDate,
    });
  }
}

/**
 * ─── EXPENSE ────────────────────────────────────────────────
 * When an expense is recorded:
 *   Dr. Expense Account (by category)
 *   Cr. Cash/Bank
 */
export async function postExpenseToLedger(
  category: string, amount: number, description: string,
  paymentMethod: string, date: string
) {
  // Map expense categories to account codes
  const categoryMap: Record<string, string> = {
    salary: "5201", utility: "5202", rent: "5203", maintenance: "5204",
    transport: "5205", internet: "5206", office: "5207", other: "5299",
  };
  const expCode = categoryMap[category] || "5299";
  const expenseAccountId = await findAccountByCode(expCode)
    || await findAccountByName(`${category} expense`)
    || await findAccountByCode("5299")
    || undefined;

  const cashId = await resolveCashAccount("expense_cash_account", paymentMethod);

  // Dr. Expense Account
  if (amount > 0 && expenseAccountId) {
    await postToLedger({
      description: description || `${category} expense`,
      account_id: expenseAccountId,
      debit: amount,
      credit: 0,
      type: "expense",
      reference: `exp-${category}`,
      date,
    });
  }

  // Cr. Cash/Bank
  if (amount > 0 && cashId) {
    await postToLedger({
      description: `Payment - ${category} expense`,
      account_id: cashId,
      debit: 0,
      credit: amount,
      type: "expense",
      reference: `exp-${category}`,
      date,
    });
  }
}
