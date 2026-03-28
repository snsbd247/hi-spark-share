import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, BookOpen } from "lucide-react";
import { toast } from "sonner";

const LEDGER_SETTINGS = [
  { key: "sales_income_account", label: "Sales Income Account", description: "সেল হলে যে লেজার অ্যাকাউন্টে ক্রেডিট হবে", type: "income" },
  { key: "sales_cash_account", label: "Sales Cash/Bank Account", description: "সেল পেমেন্ট যে ক্যাশ/ব্যাংক অ্যাকাউন্টে ডেবিট হবে", type: "asset" },
  { key: "purchase_expense_account", label: "Purchase/COGS Account", description: "পারচেজ হলে যে এক্সপেন্স অ্যাকাউন্টে ডেবিট হবে", type: "expense" },
  { key: "purchase_cash_account", label: "Purchase Cash/Bank Account", description: "পারচেজ পেমেন্ট যে ক্যাশ/ব্যাংক অ্যাকাউন্টে ক্রেডিট হবে", type: "asset" },
  { key: "service_income_account", label: "Service Income Account", description: "বিল পেমেন্ট যে ইনকাম অ্যাকাউন্টে ক্রেডিট হবে", type: "income" },
  { key: "expense_cash_account", label: "Expense Cash/Bank Account", description: "খরচ হলে যে ক্যাশ/ব্যাংক অ্যাকাউন্টে ক্রেডিট হবে", type: "asset" },
];

export default function LedgerSettingsTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["accounts-for-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("accounts").select("id, name, code, type").eq("is_active", true).order("code");
      return data || [];
    },
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["ledger-settings"],
    queryFn: async () => {
      const keys = LEDGER_SETTINGS.map(s => s.key);
      const { data } = await (supabase as any).from("system_settings").select("setting_key, setting_value").in("setting_key", keys);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
      return map;
    },
  });

  useEffect(() => {
    if (settings) setValues(settings);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(values)) {
        if (!value) continue;
        await (supabase as any).from("system_settings").upsert(
          { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
          { onConflict: "setting_key" }
        );
      }
      queryClient.invalidateQueries({ queryKey: ["ledger-settings"] });
      toast.success("Ledger settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getFilteredAccounts = (type: string) => {
    if (type === "income") return accounts.filter((a: any) => a.type === "income");
    if (type === "expense") return accounts.filter((a: any) => a.type === "expense");
    if (type === "asset") return accounts.filter((a: any) => a.type === "asset");
    return accounts;
  };

  if (isLoading || loadingAccounts) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Ledger Account Mapping</CardTitle>
        <CardDescription>সেলস, পারচেজ, বিল পেমেন্ট এবং খরচ কোন কোন লেজার অ্যাকাউন্টে পোস্ট হবে সেটি সেট করুন</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {LEDGER_SETTINGS.map(setting => (
            <div key={setting.key} className="space-y-2">
              <Label>{setting.label}</Label>
              <Select value={values[setting.key] || ""} onValueChange={v => setValues({ ...values, [setting.key]: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredAccounts(setting.type).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code ? `${a.code} - ` : ""}{a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{setting.description}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Ledger Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
