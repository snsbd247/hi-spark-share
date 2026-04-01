import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Save, Eye, EyeOff, TestTube, Mail, MessageSquare,
  Wallet, CreditCard, Wifi, WifiOff, CheckCircle2, XCircle, Settings2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useSmtpSettings, useSmsTestSend, useBkashTest, useNagadTest } from "@/hooks/useIntegrationSettings";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── SMTP Tab ────────────────────────────────────────────────────
function SmtpTab() {
  const { canEdit } = useAdminRole();
  const { settings, isLoading, saveMutation, testMutation } = useSmtpSettings();
  const [testEmail, setTestEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    smtp_host: "", smtp_port: "587", smtp_user: "", smtp_password: "",
    smtp_from_email: "", smtp_from_name: "Smart ISP", smtp_encryption: "tls",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settings && !loaded) {
      setForm((prev) => ({
        smtp_host: settings.smtp_host || prev.smtp_host,
        smtp_port: settings.smtp_port || prev.smtp_port,
        smtp_user: settings.smtp_user || prev.smtp_user,
        smtp_password: settings.smtp_password || prev.smtp_password,
        smtp_from_email: settings.smtp_from_email || prev.smtp_from_email,
        smtp_from_name: settings.smtp_from_name || prev.smtp_from_name,
        smtp_encryption: settings.smtp_encryption || prev.smtp_encryption,
      }));
      setLoaded(true);
    }
  }, [settings, loaded]);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <StatusBadge connected={!!settings?.smtp_host} label="SMTP" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> SMTP Configuration</CardTitle>
          <CardDescription>Configure email delivery settings for notifications and invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} disabled={!canEdit} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: e.target.value })} disabled={!canEdit} placeholder="587" />
            </div>
            <div className="space-y-2">
              <Label>Username / Email</Label>
              <Input value={form.smtp_user} onChange={(e) => setForm({ ...form, smtp_user: e.target.value })} disabled={!canEdit} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={form.smtp_password} onChange={(e) => setForm({ ...form, smtp_password: e.target.value })} disabled={!canEdit} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input value={form.smtp_from_email} onChange={(e) => setForm({ ...form, smtp_from_email: e.target.value })} disabled={!canEdit} placeholder="noreply@yourisp.com" />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input value={form.smtp_from_name} onChange={(e) => setForm({ ...form, smtp_from_name: e.target.value })} disabled={!canEdit} placeholder="Smart ISP" />
            </div>
            <div className="space-y-2">
              <Label>Encryption</Label>
              <Select value={form.smtp_encryption} onValueChange={(v) => setForm({ ...form, smtp_encryption: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls">TLS</SelectItem>
                  <SelectItem value="ssl">SSL</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end mt-4">
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save SMTP Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TestTube className="h-4 w-4" /> Send Test Email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label>Recipient Email</Label>
              <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
            </div>
            <Button onClick={() => testMutation.mutate(testEmail)} disabled={testMutation.isPending || !testEmail}>
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <SmtpEmailTemplates />
    </div>
  );
}

// ─── Email Templates (inside SMTP tab) ──────────────────────────
const EMAIL_TEMPLATES = [
  { key: "email_tpl_welcome", label: "Customer Welcome Email", desc: "Sent when a new customer registers" },
  { key: "email_tpl_password_reset", label: "Password Reset Email", desc: "Sent for password recovery" },
  { key: "email_tpl_payment_confirm", label: "Payment Confirmation Email", desc: "Sent after successful payment" },
  { key: "email_tpl_ticket_reply", label: "Ticket Reply Email", desc: "Sent when a support ticket gets a reply" },
  { key: "email_tpl_account_activation", label: "Account Activation Email", desc: "Sent when account is activated" },
];
const VARIABLE_HINTS = ["{CustomerName}", "{Amount}", "{Month}", "{PaymentDate}", "{TicketID}", "{CompanyName}", "{ResetLink}", "{ActivationLink}", "{PortalLink}"];

const DEMO_TEMPLATES: Record<string, string> = {
  email_tpl_welcome: `প্রিয় {CustomerName},

{CompanyName}-এ আপনাকে স্বাগতম! আপনার ইন্টারনেট সংযোগ সফলভাবে চালু করা হয়েছে।

আপনার একাউন্ট সংক্রান্ত যেকোনো তথ্যের জন্য আমাদের কাস্টমার পোর্টালে লগইন করুন:
🔗 {PortalLink}

ধন্যবাদ,
{CompanyName} টিম`,

  email_tpl_password_reset: `প্রিয় {CustomerName},

আপনার পাসওয়ার্ড রিসেট করার অনুরোধ পাওয়া গেছে। নিচের লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন:

🔗 {ResetLink}

এই লিংকটি ৩০ মিনিট পর্যন্ত কার্যকর থাকবে। আপনি যদি এই অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন।

ধন্যবাদ,
{CompanyName} টিম`,

  email_tpl_payment_confirm: `প্রিয় {CustomerName},

আপনার {Month} মাসের বিলের পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে।

পেমেন্টের পরিমাণ: ৳{Amount}
পেমেন্টের তারিখ: {PaymentDate}

ধন্যবাদ,
{CompanyName} টিম`,

  email_tpl_ticket_reply: `প্রিয় {CustomerName},

আপনার সাপোর্ট টিকেট #{TicketID}-এ নতুন রিপ্লাই এসেছে।

বিস্তারিত দেখতে কাস্টমার পোর্টালে লগইন করুন:
🔗 {PortalLink}

ধন্যবাদ,
{CompanyName} সাপোর্ট টিম`,

  email_tpl_account_activation: `প্রিয় {CustomerName},

আপনার একাউন্ট সফলভাবে সক্রিয় করা হয়েছে! এখন থেকে আপনি আমাদের ইন্টারনেট সেবা উপভোগ করতে পারবেন।

একাউন্ট অ্যাক্টিভেশন লিংক:
🔗 {ActivationLink}

কোনো সমস্যা হলে আমাদের সাপোর্ট টিমে যোগাযোগ করুন।

ধন্যবাদ,
{CompanyName} টিম`,
};

function SmtpEmailTemplates() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["email-templates-settings"],
    queryFn: async () => {
      const { data, error } = await db
        .from("system_settings" as any)
        .select("setting_key, setting_value")
        .in("setting_key", EMAIL_TEMPLATES.map((t) => t.key));
      if (error) throw error;
      const map: Record<string, string> = {};
      (data as any[])?.forEach((row: any) => { map[row.setting_key] = row.setting_value || ""; });
      return map;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const tpl of EMAIL_TEMPLATES) {
        if (form[tpl.key] !== undefined) {
          const { data: existing } = await db
            .from("system_settings" as any)
            .select("id")
            .eq("setting_key", tpl.key)
            .maybeSingle();
          if (existing) {
            const { error } = await (db as any).from("system_settings").update({ setting_value: form[tpl.key], updated_at: new Date().toISOString() }).eq("setting_key", tpl.key);
            if (error) throw error;
          } else {
            const { error } = await (db as any).from("system_settings").insert({ setting_key: tpl.key, setting_value: form[tpl.key] });
            if (error) throw error;
          }
        }
      }
      toast.success("Email templates saved");
      queryClient.invalidateQueries({ queryKey: ["email-templates-settings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Email Templates</CardTitle>
            <CardDescription className="mt-1">Configure email notification templates with dynamic variables</CardDescription>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {VARIABLE_HINTS.map((v) => (
                <Badge key={v} variant="secondary" className="text-xs font-mono">{v}</Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setForm((prev) => ({ ...prev, ...DEMO_TEMPLATES }));
                toast.success("ডেমো টেমপ্লেট লোড হয়েছে। Save Templates চাপুন।");
              }}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Load Demo
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Templates
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {EMAIL_TEMPLATES.map((tpl) => (
          <div key={tpl.key} className="space-y-1.5">
            <Label className="text-sm font-medium">{tpl.label}</Label>
            <p className="text-xs text-muted-foreground">{tpl.desc}</p>
            <Textarea
              value={form[tpl.key] || ""}
              onChange={(e) => setForm({ ...form, [tpl.key]: e.target.value })}
              rows={3}
              className="text-sm"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── SMS Tab ─────────────────────────────────────────────────────
function SmsTab() {
  const { canEdit } = useAdminRole();
  const queryClient = useQueryClient();
  const smsTestMutation = useSmsTestSend();
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("This is a test SMS from Smart ISP admin panel.");
  const [showToken, setShowToken] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["sms-settings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("sms_settings").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (settings && !form) setForm({ ...settings });
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form || !settings) return;
      const { error } = await db
        .from("sms_settings")
        .update({
          api_token: form.api_token, sender_id: form.sender_id,
          sms_on_bill_generate: form.sms_on_bill_generate, sms_on_payment: form.sms_on_payment,
          sms_on_registration: form.sms_on_registration, sms_on_suspension: form.sms_on_suspension,
          sms_on_reminder: form.sms_on_reminder,
          whatsapp_token: form.whatsapp_token, whatsapp_phone_id: form.whatsapp_phone_id,
          whatsapp_enabled: form.whatsapp_enabled, updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SMS settings saved");
      queryClient.invalidateQueries({ queryKey: ["sms-settings"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading || !form) return <LoadingState />;

  return (
    <div className="space-y-6">
      <StatusBadge connected={!!form.api_token} label="GreenWeb SMS" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> GreenWeb SMS Gateway</CardTitle>
          <CardDescription>sms.greenweb.com.bd API configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>API Token</Label>
              <div className="relative">
                <Input type={showToken ? "text" : "password"} value={form.api_token || ""} onChange={(e) => setForm({ ...form, api_token: e.target.value })} disabled={!canEdit} placeholder="Your GreenWeb API token" />
                <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sender ID</Label>
              <Input value={form.sender_id || ""} onChange={(e) => setForm({ ...form, sender_id: e.target.value })} disabled={!canEdit} placeholder="SmartISP" />
            </div>
          </div>
          <Separator />
          <h4 className="text-sm font-medium">Notification Events</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "sms_on_bill_generate", label: "Bill Generation" },
              { key: "sms_on_payment", label: "Payment Confirmation" },
              { key: "sms_on_registration", label: "New Registration" },
              { key: "sms_on_suspension", label: "Account Suspension" },
              { key: "sms_on_reminder", label: "Bill Reminder" },
              { key: "sms_on_new_customer_bill", label: "New Customer Bill" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm">{label}</span>
                <Switch checked={form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v })} disabled={!canEdit} />
              </div>
            ))}
          </div>
          <Separator />
          <h4 className="text-sm font-medium">WhatsApp Cloud API</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between sm:col-span-2 rounded-lg border border-border p-3">
              <span className="text-sm">Enable WhatsApp</span>
              <Switch checked={form.whatsapp_enabled} onCheckedChange={(v) => setForm({ ...form, whatsapp_enabled: v })} disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp API Token</Label>
              <Input type="password" value={form.whatsapp_token || ""} onChange={(e) => setForm({ ...form, whatsapp_token: e.target.value })} disabled={!canEdit} placeholder="Meta Business API token" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input value={form.whatsapp_phone_id || ""} onChange={(e) => setForm({ ...form, whatsapp_phone_id: e.target.value })} disabled={!canEdit} placeholder="WhatsApp phone number ID" />
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save SMS Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TestTube className="h-4 w-4" /> Send Test SMS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={() => smsTestMutation.mutate({ phone: testPhone, message: testMessage })} disabled={smsTestMutation.isPending || !testPhone}>
              {smsTestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Send Test SMS
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── bKash Tab ───────────────────────────────────────────────────
function BkashTab() {
  const navigate = useNavigate();
  const { canEdit } = useAdminRole();
  const queryClient = useQueryClient();
  const bkashTest = useBkashTest();
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const BASE_URLS: Record<string, string> = {
    sandbox: "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
    live: "https://tokenized.pay.bka.sh/v1.2.0-beta",
  };

  const { data: gateway, isLoading } = useQuery({
    queryKey: ["payment-gateway-bkash"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("payment_gateways").select("*").eq("gateway_name", "bkash").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ app_key: "", app_secret: "", username: "", password: "", environment: "sandbox", merchant_number: "", base_url: BASE_URLS.sandbox, receiving_account_id: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (gateway && !loaded) {
      setForm({
        app_key: gateway.app_key || "", app_secret: gateway.app_secret || "",
        username: gateway.username || "", password: gateway.password || "",
        environment: gateway.environment || "sandbox", merchant_number: gateway.merchant_number || "",
        base_url: gateway.base_url || BASE_URLS.sandbox,
        receiving_account_id: (gateway as any).receiving_account_id || "",
      });
      setLoaded(true);
    }
  }, [gateway, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { receiving_account_id, ...rest } = form;
      const payload = { gateway_name: "bkash" as const, ...rest, receiving_account_id: receiving_account_id || null, updated_at: new Date().toISOString() };
      if (gateway?.id) {
        const { error } = await db.from("payment_gateways").update(payload).eq("id", gateway.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("payment_gateways").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("bKash settings saved"); queryClient.invalidateQueries({ queryKey: ["payment-gateway-bkash"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <GatewayStatusCard gateway={gateway} testMutation={bkashTest} label="bKash" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> bKash API Configuration</CardTitle>
          <CardDescription>Configure bKash payment gateway credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>App Key</Label>
              <Input value={form.app_key} onChange={(e) => setForm({ ...form, app_key: e.target.value })} disabled={!canEdit} placeholder="Enter App Key" />
            </div>
            <PasswordField label="App Secret" value={form.app_secret} onChange={(v) => setForm({ ...form, app_secret: v })} show={showSecret} onToggle={() => setShowSecret(!showSecret)} disabled={!canEdit} />
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!canEdit} placeholder="Enter Username" />
            </div>
            <PasswordField label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} show={showPassword} onToggle={() => setShowPassword(!showPassword)} disabled={!canEdit} />
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={form.environment} onValueChange={(env) => setForm({ ...form, environment: env, base_url: BASE_URLS[env] || form.base_url })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Merchant Number</Label>
              <Input value={form.merchant_number} onChange={(e) => setForm({ ...form, merchant_number: e.target.value })} disabled={!canEdit} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} disabled={!canEdit} className="font-mono text-xs" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Receiving Ledger Account</Label>
              <LedgerAccountSelect value={form.receiving_account_id} onChange={(v) => setForm({ ...form, receiving_account_id: v })} disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">Select which ledger account receives bKash payments</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end mt-4">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save bKash Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage Transactions Link */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Transaction Management</p>
              <p className="text-xs text-muted-foreground">Query transactions, process refunds, view payment logs</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/settings/bkash")}>
              <ExternalLink className="h-4 w-4 mr-2" /> Manage Transactions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Nagad Tab ───────────────────────────────────────────────────
function NagadTab() {
  const navigate = useNavigate();
  const { canEdit } = useAdminRole();
  const queryClient = useQueryClient();
  const nagadTest = useNagadTest();
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const BASE_URLS: Record<string, string> = {
    sandbox: "https://sandbox.mynagad.com:10061/remote-payment-gateway-1.0/api/dfs",
    live: "https://api.mynagad.com/api/dfs",
  };

  const { data: gateway, isLoading } = useQuery({
    queryKey: ["payment-gateway-nagad"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("payment_gateways").select("*").eq("gateway_name", "nagad").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ app_key: "", app_secret: "", username: "", password: "", environment: "sandbox", merchant_number: "", base_url: BASE_URLS.sandbox, receiving_account_id: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (gateway && !loaded) {
      setForm({
        app_key: gateway.app_key || "", app_secret: gateway.app_secret || "",
        username: gateway.username || "", password: gateway.password || "",
        environment: gateway.environment || "sandbox", merchant_number: gateway.merchant_number || "",
        base_url: gateway.base_url || BASE_URLS.sandbox,
        receiving_account_id: (gateway as any).receiving_account_id || "",
      });
      setLoaded(true);
    }
  }, [gateway, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { receiving_account_id, ...rest } = form;
      const payload = { gateway_name: "nagad" as const, ...rest, receiving_account_id: receiving_account_id || null, updated_at: new Date().toISOString() };
      if (gateway?.id) {
        const { error } = await db.from("payment_gateways").update(payload).eq("id", gateway.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("payment_gateways").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Nagad settings saved"); queryClient.invalidateQueries({ queryKey: ["payment-gateway-nagad"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <GatewayStatusCard gateway={gateway} testMutation={nagadTest} label="Nagad" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Nagad API Configuration</CardTitle>
          <CardDescription>Configure Nagad payment gateway credentials (Merchant ID, PG Public Key, Merchant Private Key)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Merchant ID / App Key</Label>
              <Input value={form.app_key} onChange={(e) => setForm({ ...form, app_key: e.target.value })} disabled={!canEdit} placeholder="Enter Merchant ID" />
            </div>
            <PasswordField label="PG Public Key / App Secret" value={form.app_secret} onChange={(v) => setForm({ ...form, app_secret: v })} show={showSecret} onToggle={() => setShowSecret(!showSecret)} disabled={!canEdit} />
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!canEdit} placeholder="Enter Username" />
            </div>
            <PasswordField label="Merchant Private Key / Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} show={showPassword} onToggle={() => setShowPassword(!showPassword)} disabled={!canEdit} />
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={form.environment} onValueChange={(env) => setForm({ ...form, environment: env, base_url: BASE_URLS[env] || form.base_url })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Merchant Number</Label>
              <Input value={form.merchant_number} onChange={(e) => setForm({ ...form, merchant_number: e.target.value })} disabled={!canEdit} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} disabled={!canEdit} className="font-mono text-xs" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Receiving Ledger Account</Label>
              <LedgerAccountSelect value={form.receiving_account_id} onChange={(v) => setForm({ ...form, receiving_account_id: v })} disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">Select which ledger account receives Nagad payments</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end mt-4">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Nagad Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage Transactions Link */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Transaction Management</p>
              <p className="text-xs text-muted-foreground">Query transactions, process refunds, view payment logs</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/settings/nagad")}>
              <ExternalLink className="h-4 w-4 mr-2" /> Manage Transactions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────
function LedgerAccountSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-for-select"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await db.from("accounts").select("id, name, code, type").order("code");
      if (error) throw error;
      return data || [];
    },
  });
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)} disabled={disabled}>
      <SelectTrigger><SelectValue placeholder="Select Ledger Account" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— No Ledger Selected —</SelectItem>
        {accounts.map((a: any) => (
          <SelectItem key={a.id} value={a.id}>[{a.code}] {a.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LoadingState() {
  return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
}

function StatusBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {connected ? (
        <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-muted-foreground">{label} configured</span></div>
      ) : (
        <div className="flex items-center gap-2 text-sm"><XCircle className="h-4 w-4 text-destructive" /><span className="text-muted-foreground">{label} not configured</span></div>
      )}
    </div>
  );
}

function GatewayStatusCard({ gateway, testMutation, label }: { gateway: any; testMutation: any; label: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gateway?.status === "connected" ? (
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <Wifi className="h-5 w-5 text-success" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <WifiOff className="h-5 w-5 text-destructive" />
              </div>
            )}
            <div>
              <Badge variant={gateway?.status === "connected" ? "default" : "destructive"}>
                {gateway?.status === "connected" ? "Connected" : "Not Connected"}
              </Badge>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                {gateway?.environment && <span>Env: {gateway.environment}</span>}
                {gateway?.merchant_number && <span>Merchant: {gateway.merchant_number}</span>}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending || !gateway?.app_key}>
            {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
            Test {label}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, disabled }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="••••••••" />
        <button type="button" onClick={onToggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export default function IntegrationManagement() {
  const { t } = useLanguage();
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6" /> Integration Management
          </h1>
          <p className="text-muted-foreground text-sm">Configure and test all external service integrations</p>
        </div>

        <Tabs defaultValue="smtp" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="smtp" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> SMTP</TabsTrigger>
            <TabsTrigger value="bkash" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> bKash</TabsTrigger>
            <TabsTrigger value="nagad" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Nagad</TabsTrigger>
          </TabsList>

          <TabsContent value="smtp"><SmtpTab /></TabsContent>
          <TabsContent value="bkash"><BkashTab /></TabsContent>
          <TabsContent value="nagad"><NagadTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
