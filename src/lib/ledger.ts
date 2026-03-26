import { apiDb } from "@/lib/apiDb";

interface LedgerEntry {
  description: string;
  account_id?: string;
  debit: number;
  credit: number;
  type: string; // 'income' | 'expense' | 'journal'
  reference?: string;
  date?: string;
}

/**
 * Post a transaction entry to the accounting ledger (transactions table).
 * Also updates the linked account balance if account_id is provided.
 */
export async function postToLedger(entry: LedgerEntry) {
  const { error } = await apiDb.from("transactions").insert({
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
    const { data: account } = await apiDb.from("accounts").select("balance, type").eq("id", entry.account_id).maybeSingle();
    if (account) {
      const netChange = (["asset", "expense"].includes(account.type))
        ? entry.debit - entry.credit
        : entry.credit - entry.debit;
      await apiDb.from("accounts").update({ balance: Number(account.balance) + netChange }).eq("id", entry.account_id);
    }
  }
}

/**
 * Find an account by code or name (case-insensitive partial match).
 */
export async function findAccount(codeOrName: string): Promise<string | null> {
  const { data } = await apiDb.from("accounts").select("id").or(`code.eq.${codeOrName},name.ilike.%${codeOrName}%`).limit(1).maybeSingle();
  return data?.id || null;
}

/**
 * Post a sale to the ledger: Debit Cash/Bank, Credit Sales Income
 */
export async function postSaleToLedger(saleNo: string, total: number, paidAmount: number, paymentMethod: string, date: string) {
  // Income entry (credit side)
  await postToLedger({
    description: `Sale ${saleNo}`,
    debit: 0,
    credit: total,
    type: "income",
    reference: saleNo,
    date,
  });

  // If paid, debit cash/bank
  if (paidAmount > 0) {
    await postToLedger({
      description: `Payment received for ${saleNo}`,
      debit: paidAmount,
      credit: 0,
      type: "income",
      reference: saleNo,
      date,
    });
  }
}

/**
 * Post a purchase to the ledger: Debit Purchase/COGS, Credit Cash/Accounts Payable
 */
export async function postPurchaseToLedger(purchaseNo: string, total: number, paidAmount: number, date: string) {
  // Expense entry (debit side - purchase cost)
  await postToLedger({
    description: `Purchase ${purchaseNo}`,
    debit: total,
    credit: 0,
    type: "expense",
    reference: purchaseNo,
    date,
  });

  // If paid, credit cash
  if (paidAmount > 0) {
    await postToLedger({
      description: `Payment for purchase ${purchaseNo}`,
      debit: 0,
      credit: paidAmount,
      type: "expense",
      reference: purchaseNo,
      date,
    });
  }
}

/**
 * Post a customer bill payment to the ledger
 */
export async function postPaymentToLedger(customerName: string, amount: number, method: string, trxId?: string, date?: string) {
  await postToLedger({
    description: `Bill payment from ${customerName} via ${method}${trxId ? ` (${trxId})` : ""}`,
    debit: amount,
    credit: 0,
    type: "income",
    reference: trxId || `payment-${method}`,
    date: date || new Date().toISOString(),
  });
}

/**
 * Post a bill generation to the ledger (Accounts Receivable)
 */
export async function postBillToLedger(customerName: string, amount: number, month: string, date?: string) {
  await postToLedger({
    description: `Bill generated for ${customerName} - ${month}`,
    debit: amount,
    credit: 0,
    type: "journal",
    reference: `bill-${month}`,
    date: date || new Date().toISOString(),
  });
}
