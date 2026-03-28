import { supabase } from "@/integrations/supabase/client";

interface LedgerEntry {
  description: string;
  account_id?: string;
  debit: number;
  credit: number;
  type: string;
  reference?: string;
  date?: string;
}

// Cache for ledger settings
const settingsCache = new Map<string, string | null>();

/**
 * Get a ledger setting value (account ID) by key.
 */
export async function getLedgerSetting(key: string): Promise<string | null> {
  if (settingsCache.has(key)) return settingsCache.get(key)!;
  const { data } = await (supabase as any).from("system_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  const val = data?.setting_value || null;
  settingsCache.set(key, val);
  return val;
}

/**
 * Clear ledger settings cache (call after settings update).
 */
export function clearLedgerSettingsCache() {
  settingsCache.clear();
}

// Cache for account lookups within a session
const accountCache = new Map<string, string | null>();

/**
 * Find an account by code (exact match).
 */
export async function findAccountByCode(code: string): Promise<string | null> {
  if (accountCache.has(code)) return accountCache.get(code)!;
  const { data } = await ( supabase as any).from("accounts").select("id").eq("code", code).maybeSingle();
  const id = data?.id || null;
  accountCache.set(code, id);
  return id;
}

/**
 * Find an account by name (case-insensitive).
 */
export async function findAccountByName(name: string): Promise<string | null> {
  const cacheKey = `name:${name}`;
  if (accountCache.has(cacheKey)) return accountCache.get(cacheKey)!;
  const { data } = await ( supabase as any).from("accounts").select("id").ilike("name", name).maybeSingle();
  const id = data?.id || null;
  accountCache.set(cacheKey, id);
  return id;
}

/**
 * Post a transaction entry to the accounting ledger (transactions table).
 * Also updates the linked account balance if account_id is provided.
 */
export async function postToLedger(entry: LedgerEntry) {
  const { error } = await ( supabase as any).from("transactions").insert({
    description: entry.description,
    account_id: entry.account_id || null,
    debit: entry.debit,
    credit: entry.credit,
    type: entry.type,
    reference: entry.reference || null,
    date: entry.date || new Date().toISOString(),
  });
  if (error) console.error("Ledger post error:", error);

  // Update account balance if linked
  if (entry.account_id) {
    const { data: account } = await ( supabase as any).from("accounts").select("balance, type").eq("id", entry.account_id).maybeSingle();
    if (account) {
      const netChange = (["asset", "expense"].includes(account.type))
        ? entry.debit - entry.credit
        : entry.credit - entry.debit;
      await ( supabase as any).from("accounts").update({ balance: Number(account.balance) + netChange }).eq("id", entry.account_id);
    }
  }
}

/**
 * Post a sale to the ledger with proper account linking.
 * Uses settings-based account mapping (falls back to code/name lookup).
 * Debit: Cash in Hand / Bank (asset)
 * Credit: Sales Income (income)
 */
export async function postSaleToLedger(saleNo: string, total: number, paidAmount: number, paymentMethod: string, date: string) {
  // Try settings first, then fallback to code/name
  const salesIncomeId = await getLedgerSetting("sales_income_account")
    || await findAccountByCode("4100") || await findAccountByName("Sales Income");

  const settingsCashId = await getLedgerSetting("sales_cash_account");
  const cashId = settingsCashId || (paymentMethod === "bank"
    ? (await findAccountByCode("1102") || await findAccountByName("Bank Account"))
    : (await findAccountByCode("1101") || await findAccountByName("Cash in Hand")));

  // Credit Sales Income
  if (total > 0) {
    await postToLedger({
      description: `Sale ${saleNo}`,
      account_id: salesIncomeId || undefined,
      debit: 0,
      credit: total,
      type: "income",
      reference: saleNo,
      date,
    });
  }

  // Debit Cash/Bank for paid amount
  if (paidAmount > 0) {
    await postToLedger({
      description: `Payment received for ${saleNo}`,
      account_id: cashId || undefined,
      debit: paidAmount,
      credit: 0,
      type: "income",
      reference: saleNo,
      date,
    });
  }
}

/**
 * Post a purchase to the ledger with proper account linking.
 * Debit: Cost of Goods Sold / Purchase (expense)
 * Credit: Cash / Accounts Payable
 */
export async function postPurchaseToLedger(purchaseNo: string, total: number, paidAmount: number, date: string) {
  const cogsId = await findAccountByCode("5100") || await findAccountByName("Cost of Goods Sold");
  const cashId = await findAccountByCode("1101") || await findAccountByName("Cash in Hand");
  const payableId = await findAccountByCode("2100") || await findAccountByName("Accounts Payable");

  // Debit COGS/Purchase expense
  await postToLedger({
    description: `Purchase ${purchaseNo}`,
    account_id: cogsId || undefined,
    debit: total,
    credit: 0,
    type: "expense",
    reference: purchaseNo,
    date,
  });

  // Credit Cash for paid amount
  if (paidAmount > 0) {
    await postToLedger({
      description: `Payment for purchase ${purchaseNo}`,
      account_id: cashId || undefined,
      debit: 0,
      credit: paidAmount,
      type: "expense",
      reference: purchaseNo,
      date,
    });
  }

  // Credit Accounts Payable for unpaid amount
  const unpaid = total - paidAmount;
  if (unpaid > 0 && payableId) {
    await postToLedger({
      description: `Payable for ${purchaseNo}`,
      account_id: payableId,
      debit: 0,
      credit: unpaid,
      type: "journal",
      reference: purchaseNo,
      date,
    });
  }
}

/**
 * Post a customer bill payment to the ledger.
 * Debit: Cash / bKash / Bank (asset)
 * Credit: Accounts Receivable / Service Income
 */
export async function postPaymentToLedger(customerName: string, amount: number, method: string, trxId?: string, date?: string) {
  let cashId: string | null = null;
  if (method === "bkash") {
    cashId = await findAccountByCode("1103") || await findAccountByName("bKash");
  } else if (method === "nagad") {
    cashId = await findAccountByCode("1104") || await findAccountByName("Nagad");
  } else if (method === "bank") {
    cashId = await findAccountByCode("1102") || await findAccountByName("Bank Account");
  } else {
    cashId = await findAccountByCode("1101") || await findAccountByName("Cash in Hand");
  }

  const serviceIncomeId = await findAccountByCode("4000") || await findAccountByName("Service Income");

  // Debit Cash/Bank
  await postToLedger({
    description: `Bill payment from ${customerName} via ${method}${trxId ? ` (${trxId})` : ""}`,
    account_id: cashId || undefined,
    debit: amount,
    credit: 0,
    type: "income",
    reference: trxId || `payment-${method}`,
    date: date || new Date().toISOString(),
  });

  // Credit Service Income
  if (serviceIncomeId) {
    await postToLedger({
      description: `Service income from ${customerName}`,
      account_id: serviceIncomeId,
      debit: 0,
      credit: amount,
      type: "income",
      reference: trxId || `payment-${method}`,
      date: date || new Date().toISOString(),
    });
  }
}

/**
 * Post a bill generation to the ledger (Accounts Receivable).
 * Debit: Accounts Receivable
 * Credit: Service Income (accrual)
 */
export async function postBillToLedger(customerName: string, amount: number, month: string, date?: string) {
  const arId = await findAccountByCode("1200") || await findAccountByName("Accounts Receivable");

  await postToLedger({
    description: `Bill generated for ${customerName} - ${month}`,
    account_id: arId || undefined,
    debit: amount,
    credit: 0,
    type: "journal",
    reference: `bill-${month}`,
    date: date || new Date().toISOString(),
  });
}

/**
 * Post an expense to the ledger.
 * Debit: Expense account (by category mapping)
 * Credit: Cash/Bank
 */
export async function postExpenseToLedger(category: string, amount: number, description: string, paymentMethod: string, date: string) {
  // Map expense categories to account codes
  const categoryMap: Record<string, string> = {
    salary: "5200", utility: "5201", rent: "5202", maintenance: "5203",
    transport: "5204", internet: "5205", office: "5206", other: "5299",
  };
  const expCode = categoryMap[category] || "5299";
  const expenseAccountId = await findAccountByCode(expCode) || await findAccountByName(category);

  const cashId = paymentMethod === "bank"
    ? (await findAccountByCode("1102") || await findAccountByName("Bank Account"))
    : (await findAccountByCode("1101") || await findAccountByName("Cash in Hand"));

  // Debit expense account
  await postToLedger({
    description: description || `${category} expense`,
    account_id: expenseAccountId || undefined,
    debit: amount,
    credit: 0,
    type: "expense",
    reference: `exp-${category}`,
    date,
  });

  // Credit cash/bank
  if (cashId) {
    await postToLedger({
      description: `Payment for ${category} expense`,
      account_id: cashId,
      debit: 0,
      credit: amount,
      type: "expense",
      reference: `exp-${category}`,
      date,
    });
  }
}
