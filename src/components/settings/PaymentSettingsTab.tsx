import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Landmark, Plug, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const SETTINGS_KEYS = {
  merchant: "merchant_payment_account_id",
  connection: "connection_charge_account_id",
  monthly_bill: "monthly_bill_account_id",
};

export default function PaymentSettingsTab() {
  const [merchantAccountId, setMerchantAccountId] = useState("");
  const [connectionAccountId, setConnectionAccountId] = useState("");
  const [monthlyBillAccountId, setMonthlyBillAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const tenantId = useTenantId();

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts-for-payment-settings", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeByTenant(db
        .from("accounts")
        .select("id, name, code, type")
        .eq("is_active", true)
        .in("type", ["asset", "income"])
        .order("code"), tenantId);
      if (error) throw error;
      return data;
    },
  });

  const { data: currentSettings, isLoading: settingLoading } = useQuery({
    queryKey: ["system-settings-payment"],
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("system_settings")
        .select("setting_key, setting_value")
        .in("setting_key", Object.values(SETTINGS_KEYS));
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      return map;
    },
  });

  useEffect(() => {
    if (currentSettings) {
      setMerchantAccountId(currentSettings[SETTINGS_KEYS.merchant] || "");
      setConnectionAccountId(currentSettings[SETTINGS_KEYS.connection] || "");
      setMonthlyBillAccountId(currentSettings[SETTINGS_KEYS.monthly_bill] || "");
    }
  }, [currentSettings]);

  const upsertSetting = async (key: string, value: string) => {
    const { data: existing } = await (db as any)
      .from("system_settings")
      .select("id")
      .eq("setting_key", key)
      .maybeSingle();

    if (existing) {
      const { error } = await (db as any)
        .from("system_settings")
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq("setting_key", key);
      if (error) throw error;
    } else {
      const { error } = await (db as any)
        .from("system_settings")
        .insert({ setting_key: key, setting_value: value });
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertSetting(SETTINGS_KEYS.merchant, merchantAccountId);
      await upsertSetting(SETTINGS_KEYS.connection, connectionAccountId);
      await upsertSetting(SETTINGS_KEYS.monthly_bill, monthlyBillAccountId);
      toast.success(t.settings.paymentSettingsSaved);
      queryClient.invalidateQueries({ queryKey: ["system-settings-payment"] });
    } catch (err: any) {
      toast.error(err.message || t.settings.failedToSave);
    } finally {
      setSaving(false);
    }
  };

  const isLoading = accountsLoading || settingLoading;

  const AccountSelect = ({ value, onChange, label, description, icon: Icon }: {
    value: string; onChange: (v: string) => void; label: string; description: string; icon: any;
  }) => (
    <div className="space-y-2 p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-primary" />
        <Label className="font-medium">{label}</Label>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t.settings.selectAccount} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t.settings.noAccountSkip}</SelectItem>
          {accounts?.map((acc) => (
            <SelectItem key={acc.id} value={acc.id}>
              {acc.code ? `[${acc.code}] ` : ""}{acc.name} ({acc.type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            {t.settings.paymentSettingsTitle}
          </CardTitle>
          <CardDescription>
            {t.settings.paymentSettingsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                <AccountSelect
                  value={merchantAccountId}
                  onChange={setMerchantAccountId}
                  label={t.settings.merchantPaymentLedger}
                  description={t.settings.merchantPaymentDesc}
                  icon={CreditCard}
                />
                <AccountSelect
                  value={connectionAccountId}
                  onChange={setConnectionAccountId}
                  label={t.settings.connectionChargeLedger}
                  description={t.settings.connectionChargeDesc}
                  icon={Plug}
                />
                <AccountSelect
                  value={monthlyBillAccountId}
                  onChange={setMonthlyBillAccountId}
                  label={t.settings.monthlyBillLedger}
                  description={t.settings.monthlyBillDesc}
                  icon={Landmark}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {t.settings.saveSettings}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
