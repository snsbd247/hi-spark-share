import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, FileText } from "lucide-react";
import { toast } from "sonner";

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

আপনার একাউন্ট সংক্রান্ত যেকোনো তথ্যের জন্য আমাদের কাস্টমার পোর্টালে লগইন করুন।

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

বিস্তারিত দেখতে কাস্টমার পোর্টালে লগইন করুন।

ধন্যবাদ,
{CompanyName} সাপোর্ট টিম`,

  email_tpl_account_activation: `প্রিয় {CustomerName},

আপনার একাউন্ট সফলভাবে সক্রিয় করা হয়েছে! এখন থেকে আপনি আমাদের ইন্টারনেট সেবা উপভোগ করতে পারবেন।

কোনো সমস্যা হলে আমাদের সাপোর্ট টিমে যোগাযোগ করুন।

ধন্যবাদ,
{CompanyName} টিম`,
};

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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setForm((prev) => ({ ...prev, ...DEMO_TEMPLATES }));
              toast.success("ডেমো টেমপ্লেট লোড করা হয়েছে। Save All চাপুন।");
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Load Demo
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save All
          </Button>
        </div>
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
