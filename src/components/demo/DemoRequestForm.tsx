import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface DemoRequestFormProps {
  /** If true, shows a compact version (no message field) */
  compact?: boolean;
  /** Called after successful submission */
  onSuccess?: () => void;
  /** CMS metadata for labels/placeholders */
  meta?: Record<string, any>;
}

export default function DemoRequestForm({ compact = false, onSuccess, meta = {} }: DemoRequestFormProps) {
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await (db as any).from("demo_requests").insert({
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone || null,
        message: form.message || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success(meta.demo_success_toast || "🎉 Demo request submitted! We'll contact you soon.");
      onSuccess?.();
    },
    onError: (e: any) => toast.error(e.message || "Failed to submit"),
  });

  const valid = form.company_name && form.contact_name && form.email;

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-foreground">{meta.demo_success_title || "Request Submitted!"}</h3>
        <p className="text-sm text-muted-foreground">{meta.demo_success_message || "আপনার ডেমো রিকুয়েস্ট সফলভাবে জমা হয়েছে। আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে।"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{meta.label_company || "ISP / Company Name"} *</Label>
        <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder={meta.placeholder_company || "e.g. SpeedNet BD"} />
      </div>
      <div className="space-y-2">
        <Label>{meta.label_contact || "Contact Person"} *</Label>
        <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder={meta.placeholder_contact || "Your Name"} />
      </div>
      <div className="space-y-2">
        <Label>{meta.label_email || "Email"} *</Label>
        <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={meta.placeholder_email || "you@example.com"} />
      </div>
      <div className="space-y-2">
        <Label>{meta.label_phone || "Phone"}</Label>
        <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder={meta.placeholder_phone || "01XXXXXXXXX"} />
      </div>
      {!compact && (
        <div className="space-y-2">
          <Label>{meta.label_message || "Message (optional)"}</Label>
          <Input value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder={meta.placeholder_message || "আপনার ISP সম্পর্কে কিছু বলুন..."} />
        </div>
      )}
      <Button className="w-full py-6" disabled={!valid || submit.isPending} onClick={() => submit.mutate()}>
        {submit.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : <>{meta.demo_submit_text || "Submit Demo Request"} <ArrowRight className="h-4 w-4 ml-2" /></>}
      </Button>
    </div>
  );
}
