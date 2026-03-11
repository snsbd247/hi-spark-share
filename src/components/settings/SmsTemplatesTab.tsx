import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const VARIABLE_HINTS = [
  "{CustomerName}", "{Month}", "{Amount}", "{DueDate}", "{CustomerID}", "{PaymentDate}",
];

const DEFAULT_TEMPLATES = [
  { name: "Bill Generated", message: "Dear {CustomerName}, your bill for {Month} is {Amount} BDT. Due date: {DueDate}." },
  { name: "Due Reminder", message: "Dear {CustomerName}, your bill of {Amount} BDT for {Month} is due. Please pay before {DueDate}." },
  { name: "Payment Confirmation", message: "Dear {CustomerName}, we received your payment of {Amount} BDT on {PaymentDate}. Thank you!" },
  { name: "Account Suspension", message: "Dear {CustomerName}, your account has been suspended due to non-payment. Please pay your dues." },
  { name: "Customer Registration", message: "Dear {CustomerName}, welcome to Smart ISP! Your Customer ID: {CustomerID}." },
];

export default function SmsTemplatesTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, { name: string; message: string }>>({});

  const { data: templates, isLoading } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_templates").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (id: string, field: "name" | "message", value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async (template: any) => {
    const edited = editForm[template.id];
    if (!edited) return;
    setSaving(template.id);
    try {
      const { error } = await supabase
        .from("sms_templates")
        .update({ name: edited.name, message: edited.message, updated_at: new Date().toISOString() })
        .eq("id", template.id);
      if (error) throw error;
      toast.success(`Template "${edited.name}" saved`);
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleSeedDefaults = async () => {
    setSaving("seed");
    try {
      for (const tpl of DEFAULT_TEMPLATES) {
        const exists = templates?.find((t) => t.name === tpl.name);
        if (!exists) {
          const { error } = await supabase.from("sms_templates").insert(tpl);
          if (error) throw error;
        }
      }
      toast.success("Default templates added");
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("sms_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Edit SMS message templates used for automated notifications.</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {VARIABLE_HINTS.map((v) => (
              <Badge key={v} variant="secondary" className="text-xs font-mono">{v}</Badge>
            ))}
          </div>
        </div>
        {(!templates || templates.length === 0) && (
          <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={saving === "seed"}>
            {saving === "seed" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Load Defaults
          </Button>
        )}
      </div>

      {templates?.map((tpl) => {
        const edited = editForm[tpl.id] || { name: tpl.name, message: tpl.message };
        return (
          <Card key={tpl.id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={edited.name}
                  onChange={(e) => handleEdit(tpl.id, "name", e.target.value)}
                  className="font-medium text-sm max-w-xs"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  <Button size="sm" onClick={() => handleSave(tpl)} disabled={saving === tpl.id}>
                    {saving === tpl.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Textarea
                value={edited.message}
                onChange={(e) => handleEdit(tpl.id, "message", e.target.value)}
                rows={2}
                className="text-sm"
              />
            </CardContent>
          </Card>
        );
      })}

      {templates && templates.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No SMS templates yet. Click "Load Defaults" to add standard templates.</CardContent></Card>
      )}
    </div>
  );
}
