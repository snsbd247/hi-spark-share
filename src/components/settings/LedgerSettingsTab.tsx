import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LedgerSettingsTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const { t } = useLanguage();

  const LEDGER_SETTINGS = [
    { key: "sales_income_account", label: t.settings.salesIncomeAccount, description: t.settings.salesIncomeDesc, type: "income" },
    { key: "sales_cash_account", label: t.settings.salesCashAccount, description: t.settings.salesCashDesc, type: "asset" },
    { key: "purchase_expense_account", label: t.settings.purchaseExpenseAccount, description: t.settings.purchaseExpenseDesc, type: "expense" },
    { key: "purchase_cash_account", label: t.settings.purchaseCashAccount, description: t.settings.purchaseCashDesc, type: "asset" },
    { key: "service_income_account", label: t.settings.serviceIncomeAccount, description: t.settings.serviceIncomeDesc, type: "income" },
    { key: "expense_cash_account", label: t.settings.expenseCashAccount, description: t.settings.expenseCashDesc, type: "asset" },
  ];

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
      toast.success(t.settings.ledgerSettingsSaved);
    } catch {
      toast.error(t.settings.failedToSave);
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
        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> {t.settings.ledgerMappingTitle}</CardTitle>
        <CardDescription>{t.settings.ledgerMappingDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {LEDGER_SETTINGS.map(setting => (
            <div key={setting.key} className="space-y-2">
              <Label>{setting.label}</Label>
              <Select value={values[setting.key] || ""} onValueChange={v => setValues({ ...values, [setting.key]: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t.settings.selectAccount} />
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
            {t.settings.saveLedgerSettings}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
