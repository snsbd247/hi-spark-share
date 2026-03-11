import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";

const SMTP_KEYS = [
  "smtp_host", "smtp_port", "smtp_username", "smtp_password",
  "smtp_encryption", "smtp_from_email", "smtp_from_name",
];

export default function SmtpSettingsTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [form, setForm] = useState<Record<string, string>>({
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
    smtp_encryption: "tls",
    smtp_from_email: "",
    smtp_from_name: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings" as any)
        .select("setting_key, setting_value")
        .in("setting_key", SMTP_KEYS);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data as any[])?.forEach((row: any) => {
        map[row.setting_key] = row.setting_value || "";
      });
      return map;
    },
  });

  useEffect(() => {
    if (data) {
      setForm((prev) => ({
        ...prev,
        ...data,
        // Don't show actual password, show placeholder if one exists
        smtp_password: data.smtp_password ? "••••••••" : "",
      }));
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of SMTP_KEYS) {
        // Skip password if it's the masked placeholder
        if (key === "smtp_password" && form[key] === "••••••••") continue;

        const { error } = await (supabase as any)
          .from("system_settings")
          .update({ setting_value: form[key], updated_at: new Date().toISOString() })
          .eq("setting_key", key);
        if (error) throw error;
      }
      toast.success("SMTP settings saved");
      queryClient.invalidateQueries({ queryKey: ["smtp-settings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error("Enter a test email address");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject: "Smart ISP - SMTP Test Email",
          body: "This is a test email from Smart ISP to verify your SMTP configuration is working correctly.",
        },
      });
      if (error) throw error;
      toast.success("Test email sent successfully!");
    } catch (err: any) {
      toast.error(`Failed to send test email: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <CardDescription>Configure email server settings for sending system emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>SMTP Host</Label>
              <Input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Port</Label>
              <Input value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: e.target.value })} placeholder="587" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>SMTP Username</Label>
              <Input value={form.smtp_username} onChange={(e) => setForm({ ...form, smtp_username: e.target.value })} placeholder="user@gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Password</Label>
              <Input type="password" value={form.smtp_password} onChange={(e) => setForm({ ...form, smtp_password: e.target.value })} placeholder="App password" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Encryption Type</Label>
            <Select value={form.smtp_encryption} onValueChange={(v) => setForm({ ...form, smtp_encryption: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS</SelectItem>
                <SelectItem value="ssl">SSL</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>From Email Address</Label>
              <Input type="email" value={form.smtp_from_email} onChange={(e) => setForm({ ...form, smtp_from_email: e.target.value })} placeholder="noreply@smartisp.com" />
            </div>
            <div className="space-y-1.5">
              <Label>From Name</Label>
              <Input value={form.smtp_from_name} onChange={(e) => setForm({ ...form, smtp_from_name: e.target.value })} placeholder="Smart ISP" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save SMTP Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Email</CardTitle>
          <CardDescription>Send a test email to verify your SMTP configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="flex-1"
            />
            <Button onClick={handleTestEmail} disabled={testing} variant="outline">
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
