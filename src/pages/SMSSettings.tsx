import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Settings, MessageSquare, ArrowUpCircle, ArrowDownCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";

export default function SMSSettings() {
  const { t } = useLanguage();
  const { isSuperAdmin } = usePermissions();
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["sms-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("sms_settings").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  // Get tenant SMS wallet balance (for tenant users)
  const { data: walletData } = useQuery({
    queryKey: ["tenant-sms-wallet"],
    queryFn: async () => {
      // In Lovable preview, show a sample wallet
      const { data } = await db.from("sms_wallets").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  // Recent transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["tenant-sms-transactions"],
    queryFn: async () => {
      const { data } = await db
        .from("sms_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const [form, setForm] = useState<any>(null);

  if (settings && !form) {
    setForm({ ...settings });
  }

  const handleSave = async () => {
    if (!form || !settings) return;
    setSaving(true);
    try {
      const { error } = await db
        .from("sms_settings")
        .update({
          sms_on_bill_generate: form.sms_on_bill_generate,
          sms_on_payment: form.sms_on_payment,
          sms_on_registration: form.sms_on_registration,
          sms_on_suspension: form.sms_on_suspension,
          sms_on_new_customer_bill: form.sms_on_new_customer_bill,
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

  const balance = walletData?.balance ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SMS & Notification Settings</h1>
          <p className="text-muted-foreground">Manage notification preferences and view SMS balance</p>
        </div>

        {/* SMS Balance Card */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> SMS Balance
            </CardTitle>
            <CardDescription>Your SMS credit managed by Super Admin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-primary">{balance.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">SMS credits remaining</p>
              </div>
              {balance <= 10 && (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  Low Balance
                </Badge>
              )}
              {balance > 10 && balance <= 50 && (
                <Badge className="bg-yellow-500 text-sm px-3 py-1">
                  Low Balance Warning
                </Badge>
              )}
              {balance > 50 && (
                <Badge className="bg-green-600 text-sm px-3 py-1">
                  Sufficient
                </Badge>
              )}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                SMS API is centrally managed by Super Admin. Contact your service provider to recharge SMS balance.
                Each SMS deducts 1 credit (Unicode/Bangla SMS may use 2+ credits for longer messages).
              </p>
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
            {[
              { key: "sms_on_bill_generate", label: "Bill Generation", desc: "Send SMS when monthly bills are generated" },
              { key: "sms_on_payment", label: "Payment Confirmation", desc: "Send SMS after successful payment" },
              { key: "sms_on_registration", label: "New Registration", desc: "Send SMS on new customer registration" },
              { key: "sms_on_suspension", label: "Account Suspension", desc: "Send SMS when account is suspended" },
              { key: "sms_on_new_customer_bill", label: "New Customer Bill", desc: "Send bill SMS when a new customer is added" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={form[item.key]}
                  onCheckedChange={(v) => setForm({ ...form, [item.key]: v })}
                />
              </div>
            ))}
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

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent SMS Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {tx.created_at ? format(new Date(tx.created_at), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        {tx.type === "credit" ? (
                          <Badge className="bg-green-600 gap-1"><ArrowUpCircle className="h-3 w-3" /> Credit</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1"><ArrowDownCircle className="h-3 w-3" /> Debit</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{tx.amount}</TableCell>
                      <TableCell>{tx.balance_after}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.description || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
