import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Database, MapPin, BookOpen, MessageSquare, Mail, CreditCard, CheckCircle2, AlertTriangle } from "lucide-react";

// ─── Bangladesh Geo Data ─────────────────────────────────────────
const DIVISIONS = [
  { name: "Barishal", bn_name: "বরিশাল" },
  { name: "Chattogram", bn_name: "চট্টগ্রাম" },
  { name: "Dhaka", bn_name: "ঢাকা" },
  { name: "Khulna", bn_name: "খুলনা" },
  { name: "Mymensingh", bn_name: "ময়মনসিংহ" },
  { name: "Rajshahi", bn_name: "রাজশাহী" },
  { name: "Rangpur", bn_name: "রংপুর" },
  { name: "Sylhet", bn_name: "সিলেট" },
];

const DISTRICTS_BY_DIVISION: Record<string, { name: string; bn_name: string }[]> = {
  Barishal: [
    { name: "Barguna", bn_name: "বরগুনা" }, { name: "Barishal", bn_name: "বরিশাল" },
    { name: "Bhola", bn_name: "ভোলা" }, { name: "Jhalokati", bn_name: "ঝালকাঠি" },
    { name: "Patuakhali", bn_name: "পটুয়াখালী" }, { name: "Pirojpur", bn_name: "পিরোজপুর" },
  ],
  Chattogram: [
    { name: "Bandarban", bn_name: "বান্দরবান" }, { name: "Brahmanbaria", bn_name: "ব্রাহ্মণবাড়িয়া" },
    { name: "Chandpur", bn_name: "চাঁদপুর" }, { name: "Chattogram", bn_name: "চট্টগ্রাম" },
    { name: "Comilla", bn_name: "কুমিল্লা" }, { name: "Cox's Bazar", bn_name: "কক্সবাজার" },
    { name: "Feni", bn_name: "ফেনী" }, { name: "Khagrachhari", bn_name: "খাগড়াছড়ি" },
    { name: "Lakshmipur", bn_name: "লক্ষ্মীপুর" }, { name: "Noakhali", bn_name: "নোয়াখালী" },
    { name: "Rangamati", bn_name: "রাঙ্গামাটি" },
  ],
  Dhaka: [
    { name: "Dhaka", bn_name: "ঢাকা" }, { name: "Faridpur", bn_name: "ফরিদপুর" },
    { name: "Gazipur", bn_name: "গাজীপুর" }, { name: "Gopalganj", bn_name: "গোপালগঞ্জ" },
    { name: "Kishoreganj", bn_name: "কিশোরগঞ্জ" }, { name: "Madaripur", bn_name: "মাদারীপুর" },
    { name: "Manikganj", bn_name: "মানিকগঞ্জ" }, { name: "Munshiganj", bn_name: "মুন্সীগঞ্জ" },
    { name: "Narayanganj", bn_name: "নারায়ণগঞ্জ" }, { name: "Narsingdi", bn_name: "নরসিংদী" },
    { name: "Rajbari", bn_name: "রাজবাড়ী" }, { name: "Shariatpur", bn_name: "শরীয়তপুর" },
    { name: "Tangail", bn_name: "টাঙ্গাইল" },
  ],
  Khulna: [
    { name: "Bagerhat", bn_name: "বাগেরহাট" }, { name: "Chuadanga", bn_name: "চুয়াডাঙ্গা" },
    { name: "Jessore", bn_name: "যশোর" }, { name: "Jhenaidah", bn_name: "ঝিনাইদহ" },
    { name: "Khulna", bn_name: "খুলনা" }, { name: "Kushtia", bn_name: "কুষ্টিয়া" },
    { name: "Magura", bn_name: "মাগুরা" }, { name: "Meherpur", bn_name: "মেহেরপুর" },
    { name: "Narail", bn_name: "নড়াইল" }, { name: "Satkhira", bn_name: "সাতক্ষীরা" },
  ],
  Mymensingh: [
    { name: "Jamalpur", bn_name: "জামালপুর" }, { name: "Mymensingh", bn_name: "ময়মনসিংহ" },
    { name: "Netrokona", bn_name: "নেত্রকোণা" }, { name: "Sherpur", bn_name: "শেরপুর" },
  ],
  Rajshahi: [
    { name: "Bogura", bn_name: "বগুড়া" }, { name: "Chapainawabganj", bn_name: "চাঁপাইনবাবগঞ্জ" },
    { name: "Joypurhat", bn_name: "জয়পুরহাট" }, { name: "Naogaon", bn_name: "নওগাঁ" },
    { name: "Natore", bn_name: "নাটোর" }, { name: "Nawabganj", bn_name: "নবাবগঞ্জ" },
    { name: "Pabna", bn_name: "পাবনা" }, { name: "Rajshahi", bn_name: "রাজশাহী" },
    { name: "Sirajganj", bn_name: "সিরাজগঞ্জ" },
  ],
  Rangpur: [
    { name: "Dinajpur", bn_name: "দিনাজপুর" }, { name: "Gaibandha", bn_name: "গাইবান্ধা" },
    { name: "Kurigram", bn_name: "কুড়িগ্রাম" }, { name: "Lalmonirhat", bn_name: "লালমনিরহাট" },
    { name: "Nilphamari", bn_name: "নীলফামারী" }, { name: "Panchagarh", bn_name: "পঞ্চগড়" },
    { name: "Rangpur", bn_name: "রংপুর" }, { name: "Thakurgaon", bn_name: "ঠাকুরগাঁও" },
  ],
  Sylhet: [
    { name: "Habiganj", bn_name: "হবিগঞ্জ" }, { name: "Moulvibazar", bn_name: "মৌলভীবাজার" },
    { name: "Sunamganj", bn_name: "সুনামগঞ্জ" }, { name: "Sylhet", bn_name: "সিলেট" },
  ],
};

// ─── Chart of Accounts (ISP) ─────────────────────────────────────
const COA_DATA = [
  // Assets (1000)
  { name: "Assets", code: "1000", type: "asset", level: 0, is_system: true, parent_code: null },
  { name: "Cash in Hand", code: "1001", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "Cash at Bank", code: "1002", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "bKash / Nagad Account", code: "1003", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "Accounts Receivable", code: "1010", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "Inventory (Network Equipment)", code: "1020", type: "asset", level: 1, is_system: false, parent_code: "1000" },
  { name: "Fixed Assets", code: "1100", type: "asset", level: 1, is_system: true, parent_code: "1000" },
  { name: "Network Infrastructure", code: "1101", type: "asset", level: 2, is_system: false, parent_code: "1100" },
  { name: "Office Equipment", code: "1102", type: "asset", level: 2, is_system: false, parent_code: "1100" },
  { name: "Vehicles", code: "1103", type: "asset", level: 2, is_system: false, parent_code: "1100" },

  // Liabilities (2000)
  { name: "Liabilities", code: "2000", type: "liability", level: 0, is_system: true, parent_code: null },
  { name: "Accounts Payable", code: "2001", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Advance from Customers", code: "2002", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Employee Payable", code: "2003", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Tax Payable", code: "2004", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Loan Payable", code: "2010", type: "liability", level: 1, is_system: false, parent_code: "2000" },
  { name: "Provident Fund Payable", code: "2011", type: "liability", level: 1, is_system: false, parent_code: "2000" },

  // Equity (3000)
  { name: "Equity", code: "3000", type: "equity", level: 0, is_system: true, parent_code: null },
  { name: "Owner's Capital", code: "3001", type: "equity", level: 1, is_system: false, parent_code: "3000" },
  { name: "Retained Earnings", code: "3002", type: "equity", level: 1, is_system: false, parent_code: "3000" },

  // Income (4000)
  { name: "Income", code: "4000", type: "income", level: 0, is_system: true, parent_code: null },
  { name: "Monthly Subscription Income", code: "4001", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "New Connection Fee", code: "4002", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "Equipment Sales Income", code: "4003", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "Late Payment Fee", code: "4004", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "Reconnection Fee", code: "4005", type: "income", level: 1, is_system: false, parent_code: "4000" },
  { name: "Other Income", code: "4099", type: "income", level: 1, is_system: false, parent_code: "4000" },

  // Expenses (5000)
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
  { name: "Miscellaneous Expense", code: "5099", type: "expense", level: 1, is_system: false, parent_code: "5000" },
];

// ─── SMS Templates ───────────────────────────────────────────────
const SMS_TEMPLATES = [
  { name: "Bill Generated", message: "Dear {CustomerName}, your bill for {Month} is {Amount} BDT. Due date: {DueDate}. Customer ID: {CustomerID}." },
  { name: "Due Reminder", message: "Dear {CustomerName}, your bill of {Amount} BDT for {Month} is due. Please pay before {DueDate}." },
  { name: "Payment Confirmation", message: "Dear {CustomerName}, we received your payment of {Amount} BDT on {PaymentDate}. Thank you!" },
  { name: "Account Suspension", message: "Dear {CustomerName}, your internet service has been suspended due to overdue payment. Please pay your bill to restore service. Customer ID: {CustomerID}." },
  { name: "Customer Registration", message: "Dear {CustomerName}, welcome to Smart ISP! Your Customer ID: {CustomerID}. PPPoE Username: {PPPoEUsername}, Password: {PPPoEPassword}." },
  { name: "Bill Reminder", message: "Reminder: Your internet bill of {Amount} BDT is due tomorrow ({DueDate}). Please pay to avoid service suspension." },
  { name: "Service Restored", message: "Dear {CustomerName}, your internet service has been restored. Thank you for your payment!" },
  { name: "Package Upgrade", message: "Dear {CustomerName}, your internet package has been upgraded. Enjoy faster speed!" },
];

// ─── Email Templates ─────────────────────────────────────────────
const EMAIL_TEMPLATES_DATA: { key: string; value: string }[] = [
  {
    key: "email_tpl_welcome",
    value: `প্রিয় {CustomerName},\n\n{CompanyName}-এ আপনাকে স্বাগতম! আপনার ইন্টারনেট সংযোগ সফলভাবে চালু করা হয়েছে।\n\nআপনার একাউন্ট সংক্রান্ত যেকোনো তথ্যের জন্য আমাদের কাস্টমার পোর্টালে লগইন করুন।\n\nধন্যবাদ,\n{CompanyName} টিম`,
  },
  {
    key: "email_tpl_password_reset",
    value: `প্রিয় {CustomerName},\n\nআপনার পাসওয়ার্ড রিসেট করার অনুরোধ পাওয়া গেছে। নিচের লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন:\n\n🔗 {ResetLink}\n\nএই লিংকটি ৩০ মিনিট পর্যন্ত কার্যকর থাকবে।\n\nধন্যবাদ,\n{CompanyName} টিম`,
  },
  {
    key: "email_tpl_payment_confirm",
    value: `প্রিয় {CustomerName},\n\nআপনার {Month} মাসের বিলের পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে।\n\nপেমেন্টের পরিমাণ: ৳{Amount}\nপেমেন্টের তারিখ: {PaymentDate}\n\nধন্যবাদ,\n{CompanyName} টিম`,
  },
  {
    key: "email_tpl_ticket_reply",
    value: `প্রিয় {CustomerName},\n\nআপনার সাপোর্ট টিকেট #{TicketID}-এ নতুন রিপ্লাই এসেছে।\n\nবিস্তারিত দেখতে কাস্টমার পোর্টালে লগইন করুন।\n\nধন্যবাদ,\n{CompanyName} সাপোর্ট টিম`,
  },
  {
    key: "email_tpl_account_activation",
    value: `প্রিয় {CustomerName},\n\nআপনার একাউন্ট সফলভাবে সক্রিয় করা হয়েছে! এখন থেকে আপনি আমাদের ইন্টারনেট সেবা উপভোগ করতে পারবেন।\n\nধন্যবাদ,\n{CompanyName} টিম`,
  },
];

// ─── Ledger Mapping Defaults ─────────────────────────────────────
const LEDGER_MAPPING_DEFAULTS = [
  { key: "sales_income_account", label: "Sales Income → Equipment Sales Income", target_code: "4003" },
  { key: "sales_cash_account", label: "Sales Cash → Cash in Hand", target_code: "1001" },
  { key: "purchase_expense_account", label: "Purchase Expense → Equipment Purchase", target_code: "5006" },
  { key: "purchase_cash_account", label: "Purchase Cash → Cash in Hand", target_code: "1001" },
  { key: "service_income_account", label: "Service Income → Monthly Subscription", target_code: "4001" },
  { key: "expense_cash_account", label: "Expense Cash → Cash in Hand", target_code: "1001" },
];

const PAYMENT_SETTINGS_DEFAULTS = [
  { key: "merchant_payment_account_id", label: "Merchant Payment → bKash/Nagad Account", target_code: "1003" },
  { key: "connection_charge_account_id", label: "Connection Charge → New Connection Fee", target_code: "4002" },
  { key: "monthly_bill_account_id", label: "Monthly Bill → Monthly Subscription Income", target_code: "4001" },
];

type SeedStatus = "idle" | "loading" | "done" | "error";

interface SeedSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  count: string;
}

const SECTIONS: SeedSection[] = [
  { id: "geo", title: "Geo Data (Divisions/Districts/Upazilas)", description: "All 8 divisions and 64 districts of Bangladesh", icon: <MapPin className="h-5 w-5" />, count: "8 Divisions, 64 Districts" },
  { id: "coa", title: "Chart of Accounts (Ledgers)", description: "All ledger accounts required for ISP operations", icon: <BookOpen className="h-5 w-5" />, count: "40+ Accounts" },
  { id: "sms", title: "SMS Templates", description: "Bill generation, payment confirmation, reminders etc.", icon: <MessageSquare className="h-5 w-5" />, count: `${SMS_TEMPLATES.length} Templates` },
  { id: "email", title: "Email Templates", description: "Welcome, password reset, payment confirmation etc.", icon: <Mail className="h-5 w-5" />, count: `${EMAIL_TEMPLATES_DATA.length} Templates` },
  { id: "ledger", title: "Ledger Mapping + Payment Settings", description: "Auto-configure ledger mapping & payment receiving settings", icon: <CreditCard className="h-5 w-5" />, count: "9 Settings" },
];

export default function InitialDataImportTab() {
  const queryClient = useQueryClient();
  const [statuses, setStatuses] = useState<Record<string, SeedStatus>>({});
  const [logs, setLogs] = useState<Record<string, string>>({});
  const [allLoading, setAllLoading] = useState(false);

  const setStatus = (id: string, status: SeedStatus, log?: string) => {
    setStatuses(prev => ({ ...prev, [id]: status }));
    if (log) setLogs(prev => ({ ...prev, [id]: log }));
  };

  // ── Geo Data Import ───────────────────────────────────────
  const seedGeoData = async () => {
    setStatus("geo", "loading");
    try {
      let divCount = 0, distCount = 0;

      for (const div of DIVISIONS) {
        const { data: existing } = await (supabase as any).from("geo_divisions").select("id").eq("name", div.name).maybeSingle();
        let divId = existing?.id;
        if (!divId) {
          const { data, error } = await (supabase as any).from("geo_divisions").insert({ name: div.name, bn_name: div.bn_name, status: "active" }).select("id").single();
          if (error) throw error;
          divId = data.id;
          divCount++;
        }

        const districts = DISTRICTS_BY_DIVISION[div.name] || [];
        for (const dist of districts) {
          const { data: dExist } = await (supabase as any).from("geo_districts").select("id").eq("name", dist.name).eq("division_id", divId).maybeSingle();
          if (!dExist) {
            const { error } = await (supabase as any).from("geo_districts").insert({ name: dist.name, bn_name: dist.bn_name, division_id: divId, status: "active" });
            if (error) throw error;
            distCount++;
          }
        }
      }

      setStatus("geo", "done", `${divCount} divisions, ${distCount} districts added`);
      queryClient.invalidateQueries({ queryKey: ["geo-divisions-all"] });
      queryClient.invalidateQueries({ queryKey: ["geo-districts-all"] });
    } catch (e: any) {
      setStatus("geo", "error", e.message);
    }
  };

  // ── Chart of Accounts Import ──────────────────────────────
  const seedCOA = async () => {
    setStatus("coa", "loading");
    try {
      // First clear existing
      await (supabase as any).from("accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const idMap: Record<string, string> = {};
      let count = 0;

      // Insert in order (parents first)
      const sorted = [...COA_DATA].sort((a, b) => a.level - b.level);

      for (const acct of sorted) {
        const parentId = acct.parent_code ? idMap[acct.parent_code] : null;
        const { data, error } = await (supabase as any).from("accounts").insert({
          name: acct.name,
          code: acct.code,
          type: acct.type,
          level: acct.level,
          is_system: acct.is_system,
          parent_id: parentId,
          is_active: true,
          balance: 0,
        }).select("id").single();
        if (error) throw error;
        idMap[acct.code] = data.id;
        count++;
      }

      setStatus("coa", "done", `${count} লেজার অ্যাকাউন্ট তৈরি হয়েছে`);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-for-settings"] });
    } catch (e: any) {
      setStatus("coa", "error", e.message);
    }
  };

  // ── SMS Templates Import ──────────────────────────────────
  const seedSmsTemplates = async () => {
    setStatus("sms", "loading");
    try {
      let count = 0;
      for (const tpl of SMS_TEMPLATES) {
        const { data: existing } = await supabase.from("sms_templates").select("id").eq("name", tpl.name).maybeSingle();
        if (!existing) {
          const { error } = await supabase.from("sms_templates").insert(tpl as any);
          if (error) throw error;
          count++;
        }
      }
      setStatus("sms", "done", `${count} নতুন টেমপ্লেট যোগ হয়েছে`);
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (e: any) {
      setStatus("sms", "error", e.message);
    }
  };

  // ── Email Templates Import ────────────────────────────────
  const seedEmailTemplates = async () => {
    setStatus("email", "loading");
    try {
      let count = 0;
      for (const tpl of EMAIL_TEMPLATES_DATA) {
        const { data: existing } = await (supabase as any).from("system_settings").select("id").eq("setting_key", tpl.key).maybeSingle();
        if (!existing) {
          const { error } = await (supabase as any).from("system_settings").insert({ setting_key: tpl.key, setting_value: tpl.value });
          if (error) throw error;
          count++;
        }
      }
      setStatus("email", "done", `${count} ইমেইল টেমপ্লেট যোগ হয়েছে`);
    } catch (e: any) {
      setStatus("email", "error", e.message);
    }
  };

  // ── Ledger Mapping + Payment Settings ─────────────────────
  const seedLedgerSettings = async () => {
    setStatus("ledger", "loading");
    try {
      // Get all accounts to find IDs by code
      const { data: accounts } = await (supabase as any).from("accounts").select("id, code").eq("is_active", true);
      const codeToId: Record<string, string> = {};
      (accounts || []).forEach((a: any) => { if (a.code) codeToId[a.code] = a.id; });

      let count = 0;
      const allMappings = [...LEDGER_MAPPING_DEFAULTS, ...PAYMENT_SETTINGS_DEFAULTS];

      for (const mapping of allMappings) {
        const accountId = codeToId[mapping.target_code];
        if (!accountId) continue;

        await (supabase as any).from("system_settings").upsert(
          { setting_key: mapping.key, setting_value: accountId, updated_at: new Date().toISOString() },
          { onConflict: "setting_key" }
        );
        count++;
      }

      setStatus("ledger", "done", `${count} সেটিংস কনফিগার হয়েছে`);
      queryClient.invalidateQueries({ queryKey: ["ledger-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-settings-payment"] });
    } catch (e: any) {
      setStatus("ledger", "error", e.message);
    }
  };

  const seedFunctions: Record<string, () => Promise<void>> = {
    geo: seedGeoData,
    coa: seedCOA,
    sms: seedSmsTemplates,
    email: seedEmailTemplates,
    ledger: seedLedgerSettings,
  };

  const handleSeedAll = async () => {
    setAllLoading(true);
    // Run in order: geo → coa → sms → email → ledger (ledger depends on coa)
    for (const section of SECTIONS) {
      await seedFunctions[section.id]();
    }
    setAllLoading(false);
    toast.success("সব ইনিসিয়াল ডাটা সফলভাবে ইম্পোর্ট করা হয়েছে!");
  };

  const handleSeedOne = async (id: string) => {
    await seedFunctions[id]();
    toast.success("ইম্পোর্ট সম্পন্ন!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" /> ইনিসিয়াল ডাটা ইম্পোর্ট
              </CardTitle>
              <CardDescription className="mt-1">
                ISP সফটওয়্যার প্রথমবার সেটআপ করার সময় প্রয়োজনীয় সকল ডিফল্ট ডাটা একসাথে বা আলাদা আলাদা ইম্পোর্ট করুন।
              </CardDescription>
            </div>
            <Button onClick={handleSeedAll} disabled={allLoading} size="lg" className="gap-2">
              {allLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              সব ইম্পোর্ট করুন
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTIONS.map((section) => {
          const status = statuses[section.id] || "idle";
          const log = logs[section.id];

          return (
            <Card key={section.id} className={status === "done" ? "border-green-500/50" : status === "error" ? "border-destructive/50" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <div>
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{section.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">{section.count}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between gap-3">
                  {status === "done" && log && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {log}
                    </p>
                  )}
                  {status === "error" && log && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> {log}
                    </p>
                  )}
                  {status === "idle" && <span />}
                  {status === "loading" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> ইম্পোর্ট হচ্ছে...
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant={status === "done" ? "outline" : "default"}
                    onClick={() => handleSeedOne(section.id)}
                    disabled={status === "loading" || allLoading}
                    className="shrink-0"
                  >
                    {status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    {status === "done" ? "পুনরায় ইম্পোর্ট" : "ইম্পোর্ট করুন"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
