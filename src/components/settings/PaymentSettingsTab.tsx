import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Landmark } from "lucide-react";

const SETTING_KEY = "merchant_payment_account_id";

export default function PaymentSettingsTab() {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts-for-payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, code, type")
        .eq("is_active", true)
        .in("type", ["asset", "income"])
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: currentSetting, isLoading: settingLoading } = useQuery({
    queryKey: ["system-setting", SETTING_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value || "";
    },
  });

  useEffect(() => {
    if (currentSetting) setSelectedAccountId(currentSetting);
  }, [currentSetting]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_settings" as any)
        .select("id")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase as any)
          .from("system_settings")
          .update({ setting_value: selectedAccountId, updated_at: new Date().toISOString() })
          .eq("setting_key", SETTING_KEY);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("system_settings")
          .insert({ setting_key: SETTING_KEY, setting_value: selectedAccountId });
        if (error) throw error;
      }

      toast.success("Payment settings saved");
      queryClient.invalidateQueries({ queryKey: ["system-setting", SETTING_KEY] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const isLoading = accountsLoading || settingLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Merchant Payment Settings
          </CardTitle>
          <CardDescription>
            মার্চেন্ট পেমেন্ট (bKash, Nagad ইত্যাদি) রিসিভ হলে কোন একাউন্ট/লেজারে জমা হবে সেটি সিলেক্ট করুন
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Receiving Account / Ledger</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select receiving account..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No Account (Skip Ledger) —</SelectItem>
                    {accounts?.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code ? `[${acc.code}] ` : ""}{acc.name} ({acc.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  এই একাউন্টে মার্চেন্ট পেমেন্ট ম্যাচ হলে অটোমেটিক ট্রানজাকশন এন্ট্রি যোগ হবে
                </p>
              </div>

              {selectedAccountId && selectedAccountId !== "none" && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium">Selected:</p>
                  <p className="text-muted-foreground">
                    {accounts?.find((a) => a.id === selectedAccountId)?.name || "Unknown"}
                    {" "}({accounts?.find((a) => a.id === selectedAccountId)?.code || ""})
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
