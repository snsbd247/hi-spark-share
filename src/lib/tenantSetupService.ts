/**
 * TenantSetupService — Production-grade tenant data seeding
 * Handles: Geo Data, Chart of Accounts, SMS/Email Templates, Ledger Mappings
 */

import { supabase } from "@/integrations/supabase/client";
import { DIVISIONS, DISTRICTS, UPAZILAS } from "@/lib/bangladeshGeo";

// ─── Error Handling ─────────────────────────────────────────────
export interface SetupResult {
  success: boolean;
  message: string;
  error_code?: string;
  count?: number;
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

// ─── 1. Geo Data Seeder ─────────────────────────────────────────
export async function importGeoData(): Promise<SetupResult> {
  return withErrorHandling("Geo Data Import", async () => {
    // Check if already seeded
    const { count: existingCount } = await (supabase.from as any)("geo_divisions")
      .select("id", { count: "exact", head: true });
    if (existingCount && existingCount > 0) {
      return { success: true, message: "Geo data already exists, skipped", count: existingCount };
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

    // Insert in batches of 50
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

    return {
      success: true,
      message: `Geo data imported: ${DIVISIONS.length} divisions, ${insertedDistricts.length} districts, ${upazilaRows.length} upazilas`,
      count: totalInserted,
    };
  });
}

// ─── 2. Chart of Accounts Seeder ────────────────────────────────
const DEFAULT_ACCOUNTS = [
  // Assets
  { name: "Assets", type: "asset", code: "1000", level: 0, is_system: true },
  { name: "Cash in Hand", type: "asset", code: "1001", level: 1, is_system: true, parent: "Assets" },
  { name: "Cash at Bank", type: "asset", code: "1002", level: 1, is_system: true, parent: "Assets" },
  { name: "bKash Account", type: "asset", code: "1003", level: 1, is_system: true, parent: "Assets" },
  { name: "Nagad Account", type: "asset", code: "1004", level: 1, is_system: true, parent: "Assets" },
  { name: "Accounts Receivable", type: "asset", code: "1100", level: 1, is_system: true, parent: "Assets" },
  { name: "Inventory", type: "asset", code: "1200", level: 1, is_system: true, parent: "Assets" },
  { name: "Fixed Assets", type: "asset", code: "1500", level: 1, is_system: false, parent: "Assets" },
  { name: "Network Equipment", type: "asset", code: "1501", level: 2, is_system: false, parent: "Fixed Assets" },
  { name: "Office Equipment", type: "asset", code: "1502", level: 2, is_system: false, parent: "Fixed Assets" },
  // Liabilities
  { name: "Liabilities", type: "liability", code: "2000", level: 0, is_system: true },
  { name: "Accounts Payable", type: "liability", code: "2100", level: 1, is_system: true, parent: "Liabilities" },
  { name: "Employee Payable", type: "liability", code: "2200", level: 1, is_system: true, parent: "Liabilities" },
  { name: "Tax Payable", type: "liability", code: "2300", level: 1, is_system: false, parent: "Liabilities" },
  { name: "Customer Deposits", type: "liability", code: "2400", level: 1, is_system: false, parent: "Liabilities" },
  // Equity
  { name: "Equity", type: "equity", code: "3000", level: 0, is_system: true },
  { name: "Owner's Capital", type: "equity", code: "3001", level: 1, is_system: true, parent: "Equity" },
  { name: "Retained Earnings", type: "equity", code: "3002", level: 1, is_system: true, parent: "Equity" },
  // Revenue
  { name: "Revenue", type: "revenue", code: "4000", level: 0, is_system: true },
  { name: "Internet Service Revenue", type: "revenue", code: "4001", level: 1, is_system: true, parent: "Revenue" },
  { name: "Connectivity Fee Revenue", type: "revenue", code: "4002", level: 1, is_system: true, parent: "Revenue" },
  { name: "Reconnection Fee", type: "revenue", code: "4003", level: 1, is_system: false, parent: "Revenue" },
  { name: "Sales Revenue", type: "revenue", code: "4100", level: 1, is_system: false, parent: "Revenue" },
  { name: "Other Income", type: "revenue", code: "4500", level: 1, is_system: false, parent: "Revenue" },
  // Expenses
  { name: "Expenses", type: "expense", code: "5000", level: 0, is_system: true },
  { name: "Salary & Wages", type: "expense", code: "5001", level: 1, is_system: true, parent: "Expenses" },
  { name: "Office Rent", type: "expense", code: "5002", level: 1, is_system: false, parent: "Expenses" },
  { name: "Electricity Bill", type: "expense", code: "5003", level: 1, is_system: false, parent: "Expenses" },
  { name: "Internet Bandwidth Cost", type: "expense", code: "5004", level: 1, is_system: true, parent: "Expenses" },
  { name: "Transport & Conveyance", type: "expense", code: "5005", level: 1, is_system: false, parent: "Expenses" },
  { name: "Maintenance & Repair", type: "expense", code: "5006", level: 1, is_system: false, parent: "Expenses" },
  { name: "SMS & Communication", type: "expense", code: "5007", level: 1, is_system: false, parent: "Expenses" },
  { name: "Purchase Cost (COGS)", type: "expense", code: "5100", level: 1, is_system: true, parent: "Expenses" },
  { name: "Depreciation", type: "expense", code: "5200", level: 1, is_system: false, parent: "Expenses" },
  { name: "Bank Charges", type: "expense", code: "5300", level: 1, is_system: false, parent: "Expenses" },
  { name: "Miscellaneous Expense", type: "expense", code: "5900", level: 1, is_system: false, parent: "Expenses" },
];

export async function importChartOfAccounts(): Promise<SetupResult> {
  return withErrorHandling("Chart of Accounts Import", async () => {
    const { count: existingCount } = await (supabase.from as any)("accounts")
      .select("id", { count: "exact", head: true });
    if (existingCount && existingCount > 0) {
      return { success: true, message: "Chart of Accounts already exists, skipped", count: existingCount };
    }

    // First pass: insert root accounts (no parent)
    const roots = DEFAULT_ACCOUNTS.filter((a) => !a.parent);
    const rootInserts = roots.map(({ parent, ...rest }) => ({
      ...rest,
      balance: 0,
      status: "active",
    }));
    const { data: insertedRoots, error: rootErr } = await (supabase.from as any)("accounts")
      .insert(rootInserts)
      .select("id, name");
    if (rootErr) throw new Error(`Root accounts: ${rootErr.message}`);

    const nameMap: Record<string, string> = {};
    for (const r of insertedRoots) nameMap[r.name] = r.id;

    // Second pass: level 1 accounts
    const level1 = DEFAULT_ACCOUNTS.filter((a) => a.level === 1 && a.parent);
    const level1Inserts = level1.map(({ parent, ...rest }) => ({
      ...rest,
      parent_id: nameMap[parent!] || null,
      balance: 0,
      status: "active",
    }));

    for (let i = 0; i < level1Inserts.length; i += 20) {
      const batch = level1Inserts.slice(i, i + 20);
      const { data, error } = await (supabase.from as any)("accounts").insert(batch).select("id, name");
      if (error) throw new Error(`Level 1 accounts: ${error.message}`);
      for (const r of (data || [])) nameMap[r.name] = r.id;
    }

    // Third pass: level 2 accounts
    const level2 = DEFAULT_ACCOUNTS.filter((a) => a.level === 2 && a.parent);
    if (level2.length > 0) {
      const level2Inserts = level2.map(({ parent, ...rest }) => ({
        ...rest,
        parent_id: nameMap[parent!] || null,
        balance: 0,
        status: "active",
      }));
      const { error } = await (supabase.from as any)("accounts").insert(level2Inserts);
      if (error) throw new Error(`Level 2 accounts: ${error.message}`);
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

export async function importTemplates(): Promise<SetupResult> {
  return withErrorHandling("Templates Import", async () => {
    const { count: existingCount } = await (supabase.from as any)("sms_templates")
      .select("id", { count: "exact", head: true });
    if (existingCount && existingCount > 0) {
      return { success: true, message: "Templates already exist, skipped", count: existingCount };
    }

    const { error } = await (supabase.from as any)("sms_templates").insert(DEFAULT_TEMPLATES);
    if (error) throw new Error(error.message);

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

export async function importLedgerSettings(): Promise<SetupResult> {
  return withErrorHandling("Ledger Settings Import", async () => {
    const { count: expCount } = await (supabase.from as any)("expense_heads")
      .select("id", { count: "exact", head: true });
    const { count: incCount } = await (supabase.from as any)("income_heads")
      .select("id", { count: "exact", head: true });

    if ((expCount && expCount > 0) || (incCount && incCount > 0)) {
      return { success: true, message: "Ledger heads already exist, skipped", count: (expCount || 0) + (incCount || 0) };
    }

    const { error: expErr } = await (supabase.from as any)("expense_heads").insert(DEFAULT_EXPENSE_HEADS);
    if (expErr) throw new Error(`Expense heads: ${expErr.message}`);

    const { error: incErr } = await (supabase.from as any)("income_heads").insert(DEFAULT_INCOME_HEADS);
    if (incErr) throw new Error(`Income heads: ${incErr.message}`);

    return {
      success: true,
      message: `${DEFAULT_EXPENSE_HEADS.length} expense heads + ${DEFAULT_INCOME_HEADS.length} income heads imported`,
      count: DEFAULT_EXPENSE_HEADS.length + DEFAULT_INCOME_HEADS.length,
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

export async function setupAll(): Promise<FullSetupResult> {
  const geo = await importGeoData();
  const accounts = await importChartOfAccounts();
  const templates = await importTemplates();
  const ledger = await importLedgerSettings();

  return {
    geo,
    accounts,
    templates,
    ledger,
    overall: geo.success && accounts.success && templates.success && ledger.success,
  };
}

// ─── Step runner (for individual steps) ─────────────────────────
export async function runSetupStep(step: string): Promise<SetupResult> {
  switch (step) {
    case "geo": return importGeoData();
    case "accounts": return importChartOfAccounts();
    case "templates": return importTemplates();
    case "ledger": return importLedgerSettings();
    default: return { success: false, message: `Unknown setup step: ${step}`, error_code: "INVALID_STEP" };
  }
}
