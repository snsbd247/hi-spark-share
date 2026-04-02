/**
 * TenantSetupService — Production-grade tenant data seeding
 * Handles: Geo Data, Chart of Accounts, SMS/Email Templates, Ledger Mappings
 * Supports force re-import to handle "already exists" scenarios
 */

import { supabase } from "@/integrations/supabase/client";
import { unwrapApiResult } from "@/lib/apiResult";
import { DIVISIONS, DISTRICTS, UPAZILAS } from "@/lib/bangladeshGeo";

// ─── Error Handling ─────────────────────────────────────────────
export interface SetupResult {
  success: boolean;
  message: string;
  error_code?: string;
  count?: number;
  skipped?: boolean;
}

function safeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "An unexpected error occurred";
}

async function withErrorHandling(
  label: string,
  fn: () => Promise<SetupResult>
): Promise<SetupResult> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[TenantSetup] ${label} failed:`, e);
    return {
      success: false,
      message: `${label} failed: ${safeError(e)}`,
      error_code: "SETUP_ERROR",
    };
  }
}

// ─── Helper: safe count ─────────────────────────────────────────
async function tableCount(table: string): Promise<number> {
  const { count, error } = await (supabase.from as any)(table)
    .select("id", { count: "exact", head: true });
  if (error) return 0;
  return count || 0;
}

async function countSystemSettings(keys: string[]): Promise<number> {
  const { count, error } = await (supabase.from as any)("system_settings")
    .select("id", { count: "exact", head: true })
    .in("setting_key", keys);
  if (error) return 0;
  return count || 0;
}

async function saveSystemSetting(settingKey: string, settingValue: string): Promise<void> {
  const existing = unwrapApiResult(
    await (supabase.from as any)("system_settings")
      .select("id")
      .eq("setting_key", settingKey)
      .maybeSingle()
  ) as { id?: string } | null;

  if (existing?.id) {
    unwrapApiResult(
      await (supabase.from as any)("system_settings")
        .update({ setting_value: settingValue, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    );
    return;
  }

  unwrapApiResult(
    await (supabase.from as any)("system_settings").insert({
      setting_key: settingKey,
      setting_value: settingValue,
    })
  );
}

// ─── 1. Geo Data Seeder ─────────────────────────────────────────
export async function importGeoData(force = false): Promise<SetupResult> {
  return withErrorHandling("Geo Data Import", async () => {
    const existingCount = await tableCount("geo_divisions");
    if (existingCount > 0 && !force) {
      return { success: true, message: `Geo data already exists (${existingCount} divisions)`, count: existingCount, skipped: true };
    }

    // If force re-import, clear existing data first
    if (force && existingCount > 0) {
      await (supabase.from as any)("geo_upazilas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await (supabase.from as any)("geo_districts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await (supabase.from as any)("geo_divisions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    let totalInserted = 0;

    // Insert divisions
    const divisionRows = DIVISIONS.map((name) => ({ name, status: "active" }));
    const { data: insertedDivisions, error: divErr } = await (supabase.from as any)("geo_divisions")
      .insert(divisionRows)
      .select("id, name");
    if (divErr) throw new Error(`Divisions: ${divErr.message}`);
    totalInserted += insertedDivisions.length;

    // Build division name→id map
    const divMap: Record<string, string> = {};
    for (const d of insertedDivisions) divMap[d.name] = d.id;

    // Insert districts
    const districtRows: { name: string; division_id: string; status: string }[] = [];
    for (const [divName, dists] of Object.entries(DISTRICTS)) {
      const divId = divMap[divName];
      if (!divId) continue;
      for (const dist of dists) {
        districtRows.push({ name: dist, division_id: divId, status: "active" });
      }
    }

    const insertedDistricts: any[] = [];
    for (let i = 0; i < districtRows.length; i += 50) {
      const batch = districtRows.slice(i, i + 50);
      const { data, error } = await (supabase.from as any)("geo_districts").insert(batch).select("id, name");
      if (error) throw new Error(`Districts batch: ${error.message}`);
      insertedDistricts.push(...(data || []));
    }
    totalInserted += insertedDistricts.length;

    // Build district name→id map
    const distMap: Record<string, string> = {};
    for (const d of insertedDistricts) distMap[d.name] = d.id;

    // Insert upazilas
    const upazilaRows: { name: string; district_id: string; status: string }[] = [];
    for (const [distName, upas] of Object.entries(UPAZILAS)) {
      const distId = distMap[distName];
      if (!distId) continue;
      for (const upa of upas) {
        upazilaRows.push({ name: upa, district_id: distId, status: "active" });
      }
    }

    for (let i = 0; i < upazilaRows.length; i += 50) {
      const batch = upazilaRows.slice(i, i + 50);
      const { error } = await (supabase.from as any)("geo_upazilas").insert(batch);
      if (error) throw new Error(`Upazilas batch: ${error.message}`);
    }
    totalInserted += upazilaRows.length;

    // ── Verify data was actually inserted ──
    const verifyCount = await tableCount("geo_divisions");
    if (verifyCount === 0) {
      return { success: false, message: "Geo data insertion failed — 0 records found after import", error_code: "VERIFY_FAILED" };
    }

    return {
      success: true,
      message: `Geo data imported: ${DIVISIONS.length} divisions, ${insertedDistricts.length} districts, ${upazilaRows.length} upazilas`,
      count: totalInserted,
    };
  });
}

// ─── 2. Chart of Accounts Seeder ────────────────────────────────
const DEFAULT_ACCOUNTS = [
  { name: "Assets", code: "1000", type: "asset", level: 0, is_system: true, parent_code: null },
  { name: "Cash in Hand", code: "1001", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "Cash at Bank", code: "1002", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "bKash / Nagad Account", code: "1003", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "Accounts Receivable", code: "1010", type: "asset", level: 1, is_system: true, parent_code: "1000" },
  { name: "Customer Receivable", code: "1011", type: "asset", level: 2, is_system: false, parent_code: "1010" },
  { name: "Employee Advance / Receivable", code: "1012", type: "asset", level: 2, is_system: false, parent_code: "1010" },
  { name: "Other Receivable", code: "1019", type: "asset", level: 2, is_system: false, parent_code: "1010" },
  { name: "Inventory (Network Equipment)", code: "1020", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "Fixed Assets", code: "1100", type: "asset", level: 1, is_system: true, parent_code: "1000" },
  { name: "Network Infrastructure", code: "1101", type: "asset", level: 2, is_system: false, parent_code: "1100" },
  { name: "Office Equipment", code: "1102", type: "asset", level: 2, is_system: false, parent_code: "1100" },
  { name: "Vehicles", code: "1103", type: "asset", level: 2, is_system: false, parent_code: "1100" },

  { name: "Liabilities", code: "2000", type: "liability", level: 0, is_system: true, parent_code: null },
  { name: "Accounts Payable", code: "2001", type: "liability", level: 1, is_system: true, parent_code: "2000" },
  { name: "Vendor / Supplier Payable", code: "2001A", type: "liability", level: 2, is_system: false, parent_code: "2001" },
  { name: "Other Payable", code: "2001B", type: "liability", level: 2, is_system: false, parent_code: "2001" },
  { name: "Advance from Customers", code: "2002", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Employee Payable", code: "2003", type: "liability", level: 1, is_system: true, parent_code: "2000" },
  { name: "Salary Payable", code: "2003A", type: "liability", level: 2, is_system: false, parent_code: "2003" },
  { name: "Bonus Payable", code: "2003B", type: "liability", level: 2, is_system: false, parent_code: "2003" },
  { name: "Tax Payable", code: "2004", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Loan Payable", code: "2010", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Provident Fund Payable", code: "2011", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Savings Fund Payable", code: "2012", type: "liability", level: 1, is_system: false, parent_code: "2000" },

  { name: "Equity", code: "3000", type: "equity", level: 0, is_system: true, parent_code: null },
  { name: "Owner's Capital", code: "3001", type: "equity", level: 1, is_system: false, parent_code: "3000" },
  { name: "Retained Earnings", code: "3002", type: "equity", level: 1, is_system: false, parent_code: "3000" },

  { name: "Income", code: "4000", type: "income", level: 0, is_system: true, parent_code: null },
  { name: "Monthly Subscription Income", code: "4001", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "New Connection Fee", code: "4002", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "Equipment Sales Income", code: "4003", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "Late Payment Fee", code: "4004", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "Reconnection Fee", code: "4005", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "Other Income", code: "4099", type: "income", level: 1, is_system: false, parent_code: "4000" },

  { name: "Expenses", code: "5000", type: "expense", level: 0, is_system: true, parent_code: null },
  { name: "Bandwidth Cost (ISP/IIG)", code: "5001", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Salary & Wages", code: "5002", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Office Rent", code: "5003", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Electricity Bill", code: "5004", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Network Maintenance", code: "5005", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Equipment Purchase", code: "5006", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Vehicle & Transport", code: "5007", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Marketing & Advertising", code: "5008", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Mobile & Communication", code: "5009", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Government Fees & License", code: "5010", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Provident Fund Expense (Employer)", code: "5011", type: "expense", level: 1, is_system: false, parent_code: "5000" },
  { name: "Miscellaneous Expense", code: "5099", type: "expense", level: 1, is_system: false, parent_code: "5000" },
];

export async function importChartOfAccounts(force = false): Promise<SetupResult> {
  return withErrorHandling("Chart of Accounts Import", async () => {
    const existingCount = await tableCount("accounts");
    if (existingCount > 0 && !force) {
      return { success: true, message: `Chart of Accounts already exists (${existingCount} accounts)`, count: existingCount, skipped: true };
    }

    // Force: clear existing accounts
    if (force && existingCount > 0) {
      await (supabase.from as any)("accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // First pass: insert root accounts (no parent)
    const roots = DEFAULT_ACCOUNTS.filter((a) => !a.parent_code);
    const rootInserts = roots.map(({ parent_code, ...rest }) => ({
      ...rest,
      balance: 0,
      is_active: true,
      status: "active",
    }));
    const { data: insertedRoots, error: rootErr } = await (supabase.from as any)("accounts")
      .insert(rootInserts)
      .select("id, code");
    if (rootErr) throw new Error(`Root accounts: ${rootErr.message}`);

    const codeMap: Record<string, string> = {};
    for (const r of insertedRoots) codeMap[r.code] = r.id;

    // Second pass: level 1 accounts
    const level1 = DEFAULT_ACCOUNTS.filter((a) => a.level === 1 && a.parent_code);
    const level1Inserts = level1.map(({ parent_code, ...rest }) => ({
      ...rest,
      parent_id: codeMap[parent_code!] || null,
      balance: 0,
      is_active: true,
      status: "active",
    }));

    for (let i = 0; i < level1Inserts.length; i += 20) {
      const batch = level1Inserts.slice(i, i + 20);
      const { data, error } = await (supabase.from as any)("accounts").insert(batch).select("id, code");
      if (error) throw new Error(`Level 1 accounts: ${error.message}`);
      for (const r of (data || [])) codeMap[r.code] = r.id;
    }

    // Third pass: level 2 accounts
    const level2 = DEFAULT_ACCOUNTS.filter((a) => a.level === 2 && a.parent_code);
    if (level2.length > 0) {
      const level2Inserts = level2.map(({ parent_code, ...rest }) => ({
        ...rest,
        parent_id: codeMap[parent_code!] || null,
        balance: 0,
        is_active: true,
        status: "active",
      }));
      const { error } = await (supabase.from as any)("accounts").insert(level2Inserts);
      if (error) throw new Error(`Level 2 accounts: ${error.message}`);
    }

    // Verify
    const verifyCount = await tableCount("accounts");
    if (verifyCount === 0) {
      return { success: false, message: "Account import verification failed", error_code: "VERIFY_FAILED" };
    }

    return {
      success: true,
      message: `${DEFAULT_ACCOUNTS.length} accounts imported successfully`,
      count: DEFAULT_ACCOUNTS.length,
    };
  });
}

// ─── 3. SMS/Email Templates Seeder ──────────────────────────────
const DEFAULT_TEMPLATES = [
  { name: "bill_generate", message: "Dear {customer_name}, your bill of ৳{amount} for {month} has been generated. Please pay before {due_date}. — {company_name}" },
  { name: "payment_confirm", message: "Dear {customer_name}, we received ৳{amount} payment for {month}. Transaction: {trx_id}. Thank you! — {company_name}" },
  { name: "payment_reminder", message: "Dear {customer_name}, your bill of ৳{amount} for {month} is due. Please pay to avoid disconnection. — {company_name}" },
  { name: "overdue_notice", message: "Dear {customer_name}, your bill of ৳{amount} for {month} is overdue. Please pay immediately to avoid service suspension. — {company_name}" },
  { name: "new_customer", message: "Welcome {customer_name}! Your ISP account (ID: {customer_id}) is ready. Package: {package_name}. Username: {username}. — {company_name}" },
  { name: "connection_suspend", message: "Dear {customer_name}, your connection has been suspended due to non-payment. Please clear dues to restore. — {company_name}" },
  { name: "connection_restore", message: "Dear {customer_name}, your internet connection has been restored. Thank you for your payment! — {company_name}" },
  { name: "password_reset", message: "Your new password is: {password}. Please change it after login. — {company_name}" },
  { name: "bill_receipt", message: "Receipt: ৳{amount} paid by {customer_name} for {month}. Method: {method}. Ref: {trx_id}. — {company_name}" },
  { name: "package_change", message: "Dear {customer_name}, your package has been changed to {package_name} ({speed}). New bill: ৳{amount}/month. — {company_name}" },
  { name: "monthly_report", message: "Monthly Report ({month}): Total Collection ৳{total_collection}, New Customers: {new_customers}, Pending: ৳{pending}. — {company_name}" },
  { name: "birthday_wish", message: "Happy Birthday {customer_name}! Wishing you a wonderful day from {company_name} family. 🎂" },
  { name: "custom_sms", message: "{message}" },
];

export async function importTemplates(force = false): Promise<SetupResult> {
  return withErrorHandling("Templates Import", async () => {
    const existingCount = await tableCount("sms_templates");
    if (existingCount > 0 && !force) {
      return { success: true, message: `Templates already exist (${existingCount})`, count: existingCount, skipped: true };
    }

    if (force && existingCount > 0) {
      await (supabase.from as any)("sms_templates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { error } = await (supabase.from as any)("sms_templates").insert(DEFAULT_TEMPLATES);
    if (error) throw new Error(error.message);

    const verifyCount = await tableCount("sms_templates");
    if (verifyCount === 0) {
      return { success: false, message: "Templates import verification failed", error_code: "VERIFY_FAILED" };
    }

    return {
      success: true,
      message: `${DEFAULT_TEMPLATES.length} templates imported successfully`,
      count: DEFAULT_TEMPLATES.length,
    };
  });
}

// ─── 4. Ledger Mapping Seeder ───────────────────────────────────
const DEFAULT_EXPENSE_HEADS = [
  { name: "Salary & Wages", description: "Monthly employee salaries", status: "active" },
  { name: "Office Rent", description: "Monthly office rent payment", status: "active" },
  { name: "Electricity", description: "Electricity bill", status: "active" },
  { name: "Internet Bandwidth", description: "Upstream bandwidth cost", status: "active" },
  { name: "Transport", description: "Travel and transport expenses", status: "active" },
  { name: "Maintenance", description: "Equipment maintenance and repair", status: "active" },
  { name: "Stationery", description: "Office supplies", status: "active" },
  { name: "Miscellaneous", description: "Other general expenses", status: "active" },
];

const DEFAULT_INCOME_HEADS = [
  { name: "Monthly Subscription", description: "Internet service monthly fee", status: "active" },
  { name: "Connectivity Fee", description: "New connection installation fee", status: "active" },
  { name: "Reconnection Fee", description: "Reconnection charges", status: "active" },
  { name: "Equipment Sales", description: "Router/cable sales", status: "active" },
  { name: "Other Income", description: "Miscellaneous income", status: "active" },
];

const DEFAULT_LEDGER_SETTINGS = [
  { key: "sales_income_account", target_code: "4003" },
  { key: "sales_cash_account", target_code: "1001" },
  { key: "purchase_expense_account", target_code: "5006" },
  { key: "purchase_cash_account", target_code: "1001" },
  { key: "service_income_account", target_code: "4001" },
  { key: "expense_cash_account", target_code: "1001" },
  { key: "salary_expense_account", target_code: "5002" },
  { key: "salary_payable_account", target_code: "2003A" },
  { key: "salary_cash_account", target_code: "1001" },
  { key: "pf_expense_account", target_code: "5011" },
  { key: "pf_payable_account", target_code: "2011" },
  { key: "savings_fund_payable_account", target_code: "2012" },
  { key: "customer_receivable_account", target_code: "1011" },
  { key: "vendor_payable_account", target_code: "2001A" },
  { key: "employee_advance_account", target_code: "1012" },
  { key: "merchant_payment_account_id", target_code: "1003" },
  { key: "connection_charge_account_id", target_code: "4002" },
  { key: "monthly_bill_account_id", target_code: "4001" },
];

export async function importLedgerSettings(force = false): Promise<SetupResult> {
  return withErrorHandling("Ledger Settings Import", async () => {
    const expCount = await tableCount("expense_heads");
    const incCount = await tableCount("income_heads");
    const settingKeys = DEFAULT_LEDGER_SETTINGS.map((setting) => setting.key);
    const existingSettingsCount = await countSystemSettings(settingKeys);

    if ((expCount > 0 || incCount > 0 || existingSettingsCount > 0) && !force) {
      return {
        success: true,
        message: `Ledger settings already exist (${expCount} expense heads, ${incCount} income heads, ${existingSettingsCount} mappings)`,
        count: expCount + incCount + existingSettingsCount,
        skipped: true,
      };
    }

    if (force) {
      if (expCount > 0) {
        unwrapApiResult(await (supabase.from as any)("expense_heads").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
      }
      if (incCount > 0) {
        unwrapApiResult(await (supabase.from as any)("income_heads").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
      }
    }

    const { data: accounts, error: accountsErr } = await (supabase.from as any)("accounts").select("id, code");
    if (accountsErr) throw new Error(`Accounts lookup failed: ${accountsErr.message}`);

    const codeToId: Record<string, string> = {};
    (accounts || []).forEach((account: any) => {
      if (account.code) codeToId[account.code] = account.id;
    });

    const missingCodes = DEFAULT_LEDGER_SETTINGS
      .map((setting) => setting.target_code)
      .filter((code, index, arr) => arr.indexOf(code) === index)
      .filter((code) => !codeToId[code]);

    if (missingCodes.length > 0) {
      throw new Error(`Required ledger accounts are missing: ${missingCodes.join(", ")}`);
    }

    const { error: expErr } = await (supabase.from as any)("expense_heads").insert(DEFAULT_EXPENSE_HEADS);
    if (expErr) throw new Error(`Expense heads: ${expErr.message}`);

    const { error: incErr } = await (supabase.from as any)("income_heads").insert(DEFAULT_INCOME_HEADS);
    if (incErr) throw new Error(`Income heads: ${incErr.message}`);

    await Promise.all(
      DEFAULT_LEDGER_SETTINGS.map((setting) => saveSystemSetting(setting.key, codeToId[setting.target_code]))
    );

    // Verify
    const verifyExp = await tableCount("expense_heads");
    const verifyInc = await tableCount("income_heads");
    const verifySettings = await countSystemSettings(settingKeys);
    if (verifyExp === 0 && verifyInc === 0) {
      return { success: false, message: "Ledger heads import verification failed", error_code: "VERIFY_FAILED" };
    }
    if (verifySettings < DEFAULT_LEDGER_SETTINGS.length) {
      return {
        success: false,
        message: `Ledger mapping verification failed (${verifySettings}/${DEFAULT_LEDGER_SETTINGS.length} saved)`,
        error_code: "VERIFY_FAILED",
      };
    }

    return {
      success: true,
      message: `${DEFAULT_EXPENSE_HEADS.length} expense heads + ${DEFAULT_INCOME_HEADS.length} income heads + ${DEFAULT_LEDGER_SETTINGS.length} mappings imported`,
      count: DEFAULT_EXPENSE_HEADS.length + DEFAULT_INCOME_HEADS.length + DEFAULT_LEDGER_SETTINGS.length,
    };
  });
}

// ─── 5. Full Setup (One-Click) ──────────────────────────────────
export interface FullSetupResult {
  geo: SetupResult;
  accounts: SetupResult;
  templates: SetupResult;
  ledger: SetupResult;
  overall: boolean;
}

export async function setupAll(force = false): Promise<FullSetupResult> {
  const geo = await importGeoData(force);
  const accounts = await importChartOfAccounts(force);
  const templates = await importTemplates(force);
  const ledger = await importLedgerSettings(force);

  return {
    geo,
    accounts,
    templates,
    ledger,
    overall: geo.success && accounts.success && templates.success && ledger.success,
  };
}

// ─── Step runner (for individual steps) ─────────────────────────
export async function runSetupStep(step: string, force = false): Promise<SetupResult> {
  switch (step) {
    case "geo": return importGeoData(force);
    case "accounts": return importChartOfAccounts(force);
    case "templates": return importTemplates(force);
    case "ledger": return importLedgerSettings(force);
    default: return { success: false, message: `Unknown setup step: ${step}`, error_code: "INVALID_STEP" };
  }
}

// ─── 6. Partial Reset (Business Data Only) ─────────────────────
export interface ResetResult {
  success: boolean;
  message: string;
  tables_cleared: string[];
  errors: string[];
}

const BUSINESS_DATA_TABLES = [
  // Order matters: children first to avoid FK constraints
  "customer_ledger",
  "customer_sessions",
  "ticket_replies",
  "support_tickets",
  "merchant_payments",
  "payments",
  "bills",
  "onus",
  "sale_items",
  "sales",
  "purchase_items",
  "supplier_payments",
  "purchases",
  "sms_logs",
  "reminder_logs",
  "daily_reports",
  "transactions",
  "customers",
  "vendors",
  "suppliers",
  "products",
  "expenses",
];

export async function resetTenantBusinessData(): Promise<ResetResult> {
  const cleared: string[] = [];
  const errors: string[] = [];

  for (const table of BUSINESS_DATA_TABLES) {
    try {
      const { error } = await (supabase.from as any)(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        errors.push(`${table}: ${error.message}`);
      } else {
        cleared.push(table);
      }
    } catch (e) {
      errors.push(`${table}: ${safeError(e)}`);
    }
  }

  return {
    success: errors.length === 0 || cleared.length > 0,
    message: `Cleared ${cleared.length} tables. ${errors.length > 0 ? `${errors.length} skipped.` : ""}`,
    tables_cleared: cleared,
    errors,
  };
}

// ─── 7. Full System Reset (Keep ONLY super_admins) ─────────────
// Delete order: deepest FK children first, then parents
const FULL_RESET_TABLES = [
  // Deep children / logs
  "admin_login_logs",
  "admin_sessions",
  "audit_logs",
  "activity_logs",
  "backup_logs",
  "reminder_logs",
  "sms_logs",
  "daily_reports",
  "login_histories",

  // Customer children
  "customer_ledger",
  "customer_sessions",
  "ticket_replies",
  "support_tickets",
  "merchant_payments",
  "payments",
  "bills",
  "onus",

  // Sales & Purchases
  "sale_items",
  "sales",
  "purchase_items",
  "supplier_payments",
  "purchases",

  // HR children
  "employee_education",
  "employee_emergency_contacts",
  "employee_experience",
  "employee_provident_fund",
  "employee_salary_structure",
  "employee_savings_fund",
  "salary_sheets",
  "loans",
  "attendance",

  // Master tables
  "customers",
  "employees",
  "designations",
  "products",
  "expenses",
  "expense_heads",
  "income_heads",
  "other_heads",
  "vendors",
  "suppliers",
  "packages",
  "mikrotik_routers",
  "payment_gateways",
  "olts",
  "zones",

  // Accounting
  "transactions",
  "accounts",

  // Geo
  "geo_upazilas",
  "geo_districts",
  "geo_divisions",

  // Templates
  "sms_templates",

  // SMS system
  "sms_transactions",
  "sms_wallets",
  "sms_settings",
  "smtp_settings",

  // Settings (general/system)
  "general_settings",
  "system_settings",

  // Tenant system (profiles → user_roles → roles → impersonations → subscriptions → domains → tenants)
  "impersonations",
  "role_permissions",
  "user_roles",
  "profiles",
  "custom_roles",
  "permissions",
  "subscriptions",
  "plan_modules",
  "domains",
  "tenants",
  "saas_plans",
  "modules",
];

export interface FullResetResult {
  success: boolean;
  message: string;
  tables_cleared: string[];
  tables_skipped: string[];
  errors: string[];
}

export async function fullSystemReset(): Promise<FullResetResult> {
  const cleared: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // These tables are NEVER touched
  const PROTECTED = ["super_admins", "super_admin_sessions"];

  for (const table of FULL_RESET_TABLES) {
    if (PROTECTED.includes(table)) {
      skipped.push(table);
      continue;
    }
    try {
      const { error } = await (supabase.from as any)(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        errors.push(`${table}: ${error.message}`);
      } else {
        cleared.push(table);
      }
    } catch (e) {
      errors.push(`${table}: ${safeError(e)}`);
    }
  }

  return {
    success: cleared.length > 0,
    message: `Full reset complete. ${cleared.length} tables cleared, ${errors.length} errors.`,
    tables_cleared: cleared,
    tables_skipped: skipped,
    errors,
  };
}

// ─── 8. Full Reset + Demo Import (One-Click) ───────────────────
export interface FullResetAndImportResult {
  reset: FullResetResult;
  setup: FullSetupResult | null;
  overall: boolean;
}

export async function fullSystemResetAndImport(): Promise<FullResetAndImportResult> {
  // Step 1: Full reset
  const reset = await fullSystemReset();
  
  if (!reset.success) {
    return { reset, setup: null, overall: false };
  }

  // Step 2: Re-import demo/default data (force = true since we just wiped)
  const setup = await setupAll(true);

  return {
    reset,
    setup,
    overall: reset.success && (setup?.overall ?? false),
  };
}
