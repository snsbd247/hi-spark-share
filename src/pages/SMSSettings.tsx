import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";

export default function SMSSettings() {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["sms-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_settings").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);

  // Sync form with data
  if (settings && !form) {
    setForm({ ...settings });
  }

  const handleSave = async () => {
    if (!form || !settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("sms_settings")
        .update({
          api_token: form.api_token,
          sender_id: form.sender_id,
          sms_on_bill_generate: form.sms_on_bill_generate,
          sms_on_payment: form.sms_on_payment,
          sms_on_registration: form.sms_on_registration,
          sms_on_suspension: form.sms_on_suspension,
          whatsapp_token: form.whatsapp_token,
          whatsapp_phone_id: form.whatsapp_phone_id,
          whatsapp_enabled: form.whatsapp_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["sms-settings"] });
      toast.success("SMS settings saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SMS & Notification Settings</h1>
          <p className="text-muted-foreground">Configure SMS gateway and notification preferences</p>
        </div>

        {/* SMS Gateway */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> GreenWeb SMS Gateway
            </CardTitle>
            <CardDescription>sms.greenweb.com.bd API configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>API Token</Label>
              <Input
                type="password"
                value={form.api_token || ""}
                onChange={(e) => setForm({ ...form, api_token: e.target.value })}
                placeholder="Your GreenWeb API token"
              />
            </div>
            <div>
              <Label>Sender ID</Label>
              <Input
                value={form.sender_id || ""}
                onChange={(e) => setForm({ ...form, sender_id: e.target.value })}
                placeholder="SmartISP"
              />
            </div>
          </CardContent>
        </Card>

        {/* SMS Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>SMS Notification Events</CardTitle>
            <CardDescription>Enable or disable SMS for specific events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Bill Generation</p>
                <p className="text-xs text-muted-foreground">Send SMS when monthly bills are generated</p>
              </div>
              <Switch
                checked={form.sms_on_bill_generate}
                onCheckedChange={(v) => setForm({ ...form, sms_on_bill_generate: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Payment Confirmation</p>
                <p className="text-xs text-muted-foreground">Send SMS after successful payment</p>
              </div>
              <Switch
                checked={form.sms_on_payment}
                onCheckedChange={(v) => setForm({ ...form, sms_on_payment: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">New Registration</p>
                <p className="text-xs text-muted-foreground">Send SMS on new customer registration</p>
              </div>
              <Switch
                checked={form.sms_on_registration}
                onCheckedChange={(v) => setForm({ ...form, sms_on_registration: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Account Suspension</p>
                <p className="text-xs text-muted-foreground">Send SMS when account is suspended</p>
              </div>
              <Switch
                checked={form.sms_on_suspension}
                onCheckedChange={(v) => setForm({ ...form, sms_on_suspension: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Cloud API</CardTitle>
            <CardDescription>Configure WhatsApp Business API for reminders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Enable WhatsApp</p>
                <p className="text-xs text-muted-foreground">Send reminders via WhatsApp</p>
              </div>
              <Switch
                checked={form.whatsapp_enabled}
                onCheckedChange={(v) => setForm({ ...form, whatsapp_enabled: v })}
              />
            </div>
            <div>
              <Label>WhatsApp API Token</Label>
              <Input
                type="password"
                value={form.whatsapp_token || ""}
                onChange={(e) => setForm({ ...form, whatsapp_token: e.target.value })}
                placeholder="Meta Business API token"
              />
            </div>
            <div>
              <Label>Phone Number ID</Label>
              <Input
                value={form.whatsapp_phone_id || ""}
                onChange={(e) => setForm({ ...form, whatsapp_phone_id: e.target.value })}
                placeholder="Your WhatsApp phone number ID"
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </DashboardLayout>
  );
}
