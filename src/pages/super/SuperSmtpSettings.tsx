import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Mail, Save, Send, Server, Shield, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SuperSmtpSettings() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const [testEmail, setTestEmail] = useState("");

  const { data: smtp, isLoading } = useQuery({
    queryKey: ["super-smtp-settings"],
    queryFn: superAdminApi.getSmtpSettings,
  });

  const [form, setForm] = useState<any>(null);

  // Initialize form when data loads
  const currentForm = form ?? smtp ?? {};

  const updateField = (key: string, value: any) => {
    setForm((prev: any) => ({ ...(prev ?? smtp ?? {}), [key]: value }));
  };

  const saveMut = useMutation({
    mutationFn: () => superAdminApi.updateSmtpSettings(form ?? smtp),
    onSuccess: () => {
      toast.success("SMTP settings saved successfully");
      qc.invalidateQueries({ queryKey: ["super-smtp-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => superAdminApi.testSmtp(testEmail),
    onSuccess: (result: any) => {
      if (result.success) {
        toast.success("Test email sent successfully!");
      } else {
        toast.error(result.error || "Failed to send test email");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Mail className="h-6 w-6" /> {sa.smtpEmailSettings}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure centralized SMTP for all tenant email communications
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SMTP Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" /> {sa.smtpServerConfig}
              </CardTitle>
              <CardDescription>
                All system emails will be sent through this SMTP server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{sa.smtpHost}</Label>
                  <Input
                    value={currentForm.host || ""}
                    onChange={(e) => updateField("host", e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{sa.port}</Label>
                  <Input
                    type="number"
                    value={currentForm.port || 587}
                    onChange={(e) => updateField("port", Number(e.target.value))}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{sa.username}</Label>
                  <Input
                    value={currentForm.username || ""}
                    onChange={(e) => updateField("username", e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{sa.password}</Label>
                  <Input
                    type="password"
                    value={currentForm.password || ""}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{sa.encryption}</Label>
                  <Select
                    value={currentForm.encryption || "tls"}
                    onValueChange={(v) => updateField("encryption", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS</SelectItem>
                      <SelectItem value="ssl">SSL</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.common.status}</Label>
                  <Select
                    value={currentForm.status || "active"}
                    onValueChange={(v) => updateField("status", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{sa.fromEmail}</Label>
                  <Input
                    value={currentForm.from_email || ""}
                    onChange={(e) => updateField("from_email", e.target.value)}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{sa.fromName}</Label>
                  <Input
                    value={currentForm.from_name || ""}
                    onChange={(e) => updateField("from_name", e.target.value)}
                    placeholder="Smart ISP"
                  />
                </div>
              </div>

              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full sm:w-auto">
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save SMTP Settings
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Test & Status Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5" /> {t.common.status}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentForm.host ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">{sa.smtpConfigured}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Not Configured</Badge>
                </div>
              )}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Tenant welcome emails</p>
                <p>• Password reset emails</p>
                <p>• Billing notifications</p>
                <p>• System alerts</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-5 w-5" /> {sa.testEmail}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>{sa.sendTestTo}</Label>
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => testMut.mutate()}
                disabled={!testEmail || testMut.isPending}
              >
                {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Test Email
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
