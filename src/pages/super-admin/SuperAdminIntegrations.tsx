import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Send, Eye, EyeOff, Wifi, WifiOff, TestTube, Mail, CreditCard, MessageSquare, Globe, Clock } from "lucide-react";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────
interface PlatformIntegration {
  id: string;
  smtp_host: string | null; smtp_port: string | null; smtp_username: string | null; smtp_password: string | null;
  smtp_encryption: string | null; smtp_from_email: string | null; smtp_from_name: string | null;
  smtp_status: string | null; smtp_last_connected_at: string | null;
  bkash_app_key: string | null; bkash_app_secret: string | null; bkash_username: string | null; bkash_password: string | null;
  bkash_base_url: string | null; bkash_environment: string | null;
  bkash_status: string | null; bkash_last_connected_at: string | null;
  nagad_api_key: string | null; nagad_api_secret: string | null; nagad_base_url: string | null;
  nagad_status: string | null; nagad_last_connected_at: string | null;
  sms_gateway_url: string | null; sms_api_key: string | null; sms_sender_id: string | null;
  sms_status: string | null; sms_last_connected_at: string | null;
  updated_at: string | null;
}

function StatusBadge({ status, lastConnected }: { status: string | null; lastConnected: string | null }) {
  const connected = status === "connected";
  return (
    <div className="flex items-center gap-2">
      <Badge variant={connected ? "default" : "secondary"} className="gap-1">
        {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {connected ? "Connected" : "Not Connected"}
      </Badge>
      {lastConnected && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> {format(new Date(lastConnected), "dd MMM yyyy, hh:mm a")}
        </span>
      )}
    </div>
  );
}

function MaskedInput({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const isSecret = type === "password";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input type={isSecret && !show ? "password" : "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        {isSecret && (
          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShow(!show)}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── SMTP Section ───────────────────────────────────────────
function SmtpSection({ data, onSave, onTest }: { data: PlatformIntegration; onSave: (updates: Partial<PlatformIntegration>) => Promise<void>; onTest: (section: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: "587", smtp_username: "", smtp_password: "",
    smtp_encryption: "tls", smtp_from_email: "", smtp_from_name: "",
  });

  useEffect(() => {
    setForm({
      smtp_host: data.smtp_host || "",
      smtp_port: data.smtp_port || "587",
      smtp_username: data.smtp_username || "",
      smtp_password: data.smtp_password ? "••••••••" : "",
      smtp_encryption: data.smtp_encryption || "tls",
      smtp_from_email: data.smtp_from_email || "",
      smtp_from_name: data.smtp_from_name || "",
    });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = { ...form };
      if (updates.smtp_password === "••••••••") delete updates.smtp_password;
      await onSave(updates);
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testEmail) { toast.error("Enter a test email address"); return; }
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: { to: testEmail, subject: "SMTP Test - ISP Platform", html: "<p>SMTP configuration is working correctly.</p>" },
      });
      if (error) throw error;
      toast.success("Test email sent successfully!");
      await onTest("smtp");
    } catch (err: any) { toast.error(err.message); }
    finally { setTesting(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> SMTP Server Configuration</CardTitle>
            <StatusBadge status={data.smtp_status} lastConnected={data.smtp_last_connected_at} />
          </div>
          <CardDescription>Central email server used by all tenants for system emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MaskedInput label="SMTP Host" value={form.smtp_host} onChange={v => setForm({ ...form, smtp_host: v })} placeholder="smtp.gmail.com" />
            <MaskedInput label="SMTP Port" value={form.smtp_port} onChange={v => setForm({ ...form, smtp_port: v })} placeholder="587" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MaskedInput label="Username" value={form.smtp_username} onChange={v => setForm({ ...form, smtp_username: v })} placeholder="user@gmail.com" />
            <MaskedInput label="Password" value={form.smtp_password} onChange={v => setForm({ ...form, smtp_password: v })} type="password" placeholder="App password" />
          </div>
          <div className="space-y-1.5">
            <Label>Encryption</Label>
            <Select value={form.smtp_encryption} onValueChange={v => setForm({ ...form, smtp_encryption: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS</SelectItem>
                <SelectItem value="ssl">SSL</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MaskedInput label="From Email" value={form.smtp_from_email} onChange={v => setForm({ ...form, smtp_from_email: v })} placeholder="noreply@isp.com" />
            <MaskedInput label="From Name" value={form.smtp_from_name} onChange={v => setForm({ ...form, smtp_from_name: v })} placeholder="ISP Platform" />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save SMTP
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TestTube className="h-4 w-4 text-primary" /> Test SMTP</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" className="flex-1" />
            <Button onClick={handleTest} disabled={testing} variant="outline">
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Send Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Payment Gateway Section (bKash + Nagad) ────────────────
function PaymentGatewaySection({ data, gateway, onSave, onTest }: {
  data: PlatformIntegration; gateway: "bkash" | "nagad"; onSave: (updates: Partial<PlatformIntegration>) => Promise<void>; onTest: (section: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const isBkash = gateway === "bkash";
  const label = isBkash ? "bKash" : "Nagad";

  const bkashUrls: Record<string, string> = { sandbox: "https://tokenized.sandbox.bka.sh/v1.2.0-beta", live: "https://tokenized.pay.bka.sh/v1.2.0-beta" };
  const nagadUrls: Record<string, string> = { sandbox: "https://sandbox.mynagad.com:10061/remote-payment-gateway-1.0/api/dfs", live: "https://api.mynagad.com/api/dfs" };

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isBkash) {
      setForm({
        bkash_app_key: data.bkash_app_key || "",
        bkash_app_secret: data.bkash_app_secret ? "••••••••" : "",
        bkash_username: data.bkash_username || "",
        bkash_password: data.bkash_password ? "••••••••" : "",
        bkash_base_url: data.bkash_base_url || bkashUrls.sandbox,
        bkash_environment: data.bkash_environment || "sandbox",
      });
    } else {
      setForm({
        nagad_api_key: data.nagad_api_key || "",
        nagad_api_secret: data.nagad_api_secret ? "••••••••" : "",
        nagad_base_url: data.nagad_base_url || nagadUrls.sandbox,
      });
    }
  }, [data, gateway]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = { ...form };
      if (isBkash) {
        if (updates.bkash_app_secret === "••••••••") delete updates.bkash_app_secret;
        if (updates.bkash_password === "••••••••") delete updates.bkash_password;
      } else {
        if (updates.nagad_api_secret === "••••••••") delete updates.nagad_api_secret;
      }
      await onSave(updates);
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      if (isBkash) {
        const { error } = await supabase.functions.invoke("bkash-payment", { body: { action: "test" } });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke("nagad-payment", { body: { action: "test" } });
        if (error) throw error;
      }
      toast.success(`${label} API connection test successful!`);
      await onTest(gateway);
    } catch (err: any) { toast.error(`${label} test failed: ${err.message}`); }
    finally { setTesting(false); }
  };

  const status = isBkash ? data.bkash_status : data.nagad_status;
  const lastConnected = isBkash ? data.bkash_last_connected_at : data.nagad_last_connected_at;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> {label} API Configuration</CardTitle>
          <StatusBadge status={status} lastConnected={lastConnected} />
        </div>
        <CardDescription>Central {label} payment gateway shared by all tenants</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isBkash ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MaskedInput label="App Key" value={form.bkash_app_key || ""} onChange={v => setForm({ ...form, bkash_app_key: v })} />
              <MaskedInput label="App Secret" value={form.bkash_app_secret || ""} onChange={v => setForm({ ...form, bkash_app_secret: v })} type="password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MaskedInput label="Username" value={form.bkash_username || ""} onChange={v => setForm({ ...form, bkash_username: v })} />
              <MaskedInput label="Password" value={form.bkash_password || ""} onChange={v => setForm({ ...form, bkash_password: v })} type="password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select value={form.bkash_environment || "sandbox"} onValueChange={v => setForm({ ...form, bkash_environment: v, bkash_base_url: bkashUrls[v] || "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <MaskedInput label="Base URL" value={form.bkash_base_url || ""} onChange={v => setForm({ ...form, bkash_base_url: v })} />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MaskedInput label="API Key" value={form.nagad_api_key || ""} onChange={v => setForm({ ...form, nagad_api_key: v })} />
              <MaskedInput label="API Secret" value={form.nagad_api_secret || ""} onChange={v => setForm({ ...form, nagad_api_secret: v })} type="password" />
            </div>
            <MaskedInput label="Base URL" value={form.nagad_base_url || ""} onChange={v => setForm({ ...form, nagad_base_url: v })} />
          </>
        )}
        <div className="flex justify-end gap-3">
          <Button onClick={handleTest} disabled={testing} variant="outline">
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />} Test {label}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save {label}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SMS Gateway Section ────────────────────────────────────
function SmsGatewaySection({ data, onSave, onTest }: { data: PlatformIntegration; onSave: (updates: Partial<PlatformIntegration>) => Promise<void>; onTest: (section: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [form, setForm] = useState({ sms_gateway_url: "", sms_api_key: "", sms_sender_id: "" });

  useEffect(() => {
    setForm({
      sms_gateway_url: data.sms_gateway_url || "",
      sms_api_key: data.sms_api_key ? "••••••••" : "",
      sms_sender_id: data.sms_sender_id || "",
    });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = { ...form };
      if (updates.sms_api_key === "••••••••") delete updates.sms_api_key;
      await onSave(updates);
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testPhone) { toast.error("Enter a test phone number"); return; }
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("send-sms", {
        body: { to: testPhone, message: "SMS Gateway Test - ISP Platform. Configuration working." },
      });
      if (error) throw error;
      toast.success("Test SMS sent successfully!");
      await onTest("sms");
    } catch (err: any) { toast.error(err.message); }
    finally { setTesting(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> SMS Gateway Configuration</CardTitle>
            <StatusBadge status={data.sms_status} lastConnected={data.sms_last_connected_at} />
          </div>
          <CardDescription>Central SMS gateway shared by all tenants for notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MaskedInput label="Gateway URL" value={form.sms_gateway_url} onChange={v => setForm({ ...form, sms_gateway_url: v })} placeholder="https://api.greenweb.com.bd/api.php" />
          <MaskedInput label="API Key / Token" value={form.sms_api_key} onChange={v => setForm({ ...form, sms_api_key: v })} type="password" placeholder="Your API key" />
          <MaskedInput label="Sender ID" value={form.sms_sender_id} onChange={v => setForm({ ...form, sms_sender_id: v })} placeholder="SmartISP" />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save SMS Settings
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TestTube className="h-4 w-4 text-primary" /> Test SMS Gateway</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="01XXXXXXXXX" className="flex-1" />
            <Button onClick={handleTest} disabled={testing} variant="outline">
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Send Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function SuperAdminIntegrations() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["platform-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_integrations" as any)
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data as unknown as PlatformIntegration;
    },
  });

  const handleSave = async (updates: Partial<PlatformIntegration>) => {
    if (!data?.id) return;
    const { error } = await supabase
      .from("platform_integrations" as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", data.id);
    if (error) throw error;
    toast.success("Settings saved successfully");
    queryClient.invalidateQueries({ queryKey: ["platform-integrations"] });
  };

  const handleTestSuccess = async (section: string) => {
    if (!data?.id) return;
    const statusField = `${section}_status`;
    const lastField = `${section}_last_connected_at`;
    await supabase
      .from("platform_integrations" as any)
      .update({ [statusField]: "connected", [lastField]: new Date().toISOString() } as any)
      .eq("id", data.id);
    queryClient.invalidateQueries({ queryKey: ["platform-integrations"] });
  };

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </SuperAdminLayout>
    );
  }

  if (!data) {
    return (
      <SuperAdminLayout>
        <div className="text-center py-16 text-muted-foreground">No integration record found. Please contact support.</div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Platform Integrations</h1>
            <p className="text-muted-foreground text-sm">Centralized configurations shared by all tenants</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="smtp" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="smtp" className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> SMTP</TabsTrigger>
          <TabsTrigger value="bkash" className="flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> bKash</TabsTrigger>
          <TabsTrigger value="nagad" className="flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Nagad</TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> SMS</TabsTrigger>
        </TabsList>

        <TabsContent value="smtp"><SmtpSection data={data} onSave={handleSave} onTest={handleTestSuccess} /></TabsContent>
        <TabsContent value="bkash"><PaymentGatewaySection data={data} gateway="bkash" onSave={handleSave} onTest={handleTestSuccess} /></TabsContent>
        <TabsContent value="nagad"><PaymentGatewaySection data={data} gateway="nagad" onSave={handleSave} onTest={handleTestSuccess} /></TabsContent>
        <TabsContent value="sms"><SmsGatewaySection data={data} onSave={handleSave} onTest={handleTestSuccess} /></TabsContent>
      </Tabs>
    </SuperAdminLayout>
  );
}
