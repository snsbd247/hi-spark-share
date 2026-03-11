import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const EMAIL_TEMPLATES = [
  { key: "email_tpl_welcome", label: "Customer Welcome Email", desc: "Sent when a new customer registers" },
  { key: "email_tpl_password_reset", label: "Password Reset Email", desc: "Sent for password recovery" },
  { key: "email_tpl_payment_confirm", label: "Payment Confirmation Email", desc: "Sent after successful payment" },
  { key: "email_tpl_ticket_reply", label: "Ticket Reply Email", desc: "Sent when a support ticket gets a reply" },
  { key: "email_tpl_account_activation", label: "Account Activation Email", desc: "Sent when account is activated" },
];

const VARIABLE_HINTS = ["{CustomerName}", "{Amount}", "{Month}", "{PaymentDate}", "{TicketID}", "{CompanyName}"];

export default function EmailTemplatesTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["email-templates-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
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
          const { error } = await (supabase as any)
            .from("system_settings")
            .update({ setting_value: form[tpl.key], updated_at: new Date().toISOString() })
            .eq("setting_key", tpl.key);
          if (error) throw error;
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

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Configure email notification templates with dynamic variables.</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {VARIABLE_HINTS.map((v) => (
              <Badge key={v} variant="secondary" className="text-xs font-mono">{v}</Badge>
            ))}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save All
        </Button>
      </div>

      {EMAIL_TEMPLATES.map((tpl) => (
        <Card key={tpl.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{tpl.label}</CardTitle>
            <CardDescription className="text-xs">{tpl.desc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form[tpl.key] || ""}
              onChange={(e) => setForm({ ...form, [tpl.key]: e.target.value })}
              rows={3}
              className="text-sm"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
