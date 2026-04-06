import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const VARIABLE_HINTS = [
  "{CustomerName}", "{Month}", "{Amount}", "{DueDate}", "{CustomerID}", "{PaymentDate}",
  "{PPPoEUsername}", "{PPPoEPassword}",
];

const SAMPLE_DATA: Record<string, string> = {
  "{CustomerName}": "Rahim Uddin",
  "{Month}": "2026-04",
  "{Amount}": "1,200",
  "{DueDate}": "10 Apr 2026",
  "{CustomerID}": "SN-0042",
  "{PaymentDate}": "06 Apr 2026",
  "{PPPoEUsername}": "rahim_pppoe",
  "{PPPoEPassword}": "pass1234",
};

const DEFAULT_TEMPLATES = [
  { name: "Bill Generated", message: "Dear {CustomerName}, your bill for {Month} is {Amount} BDT. Due date: {DueDate}." },
  { name: "Due Reminder", message: "Dear {CustomerName}, your bill of {Amount} BDT for {Month} is due. Please pay before {DueDate}." },
  { name: "Payment Confirmation", message: "Dear {CustomerName}, we received your payment of {Amount} BDT on {PaymentDate}. Thank you!" },
  { name: "Account Suspension", message: "Dear {CustomerName}, your account has been suspended due to non-payment. Please pay your dues." },
  { name: "Customer Registration", message: "Dear {CustomerName}, welcome to Smart ISP! Your Customer ID: {CustomerID}. PPPoE Username: {PPPoEUsername}, Password: {PPPoEPassword}." },
  { name: "Overdue Notice", message: "Dear {CustomerName}, your bill of {Amount} BDT for {Month} is overdue! Please pay immediately to avoid disconnection." },
  { name: "Reconnection Notice", message: "Dear {CustomerName}, your account has been reconnected. Thank you for the payment of {Amount} BDT." },
];

function previewMessage(msg: string): string {
  let result = msg;
  for (const [key, val] of Object.entries(SAMPLE_DATA)) {
    result = result.split(key).join(val);
  }
  return result;
}

export default function SmsTemplatesTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, { name: string; message: string }>>({});
  const [showPreview, setShowPreview] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const { data, error } = await db.from("sms_templates").select("*").order("created_at");
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
      const { error } = await db
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
          const { error } = await db.from("sms_templates").insert(tpl);
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
      const { error } = await db.from("sms_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddNew = async () => {
    if (!newName.trim() || !newMessage.trim()) return;
    setSaving("new");
    try {
      const { error } = await db.from("sms_templates").insert({ name: newName.trim(), message: newMessage.trim() });
      if (error) throw error;
      toast.success("Template created");
      setNewName("");
      setNewMessage("");
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const charCount = (msg: string) => {
    const len = msg.length;
    const smsCount = Math.ceil(len / 160) || 1;
    return `${len} chars • ${smsCount} SMS unit${smsCount > 1 ? "s" : ""}`;
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
              <Badge key={v} variant="secondary" className="text-xs font-mono cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => navigator.clipboard.writeText(v).then(() => toast.success(`Copied ${v}`))}
              >
                {v}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {(!templates || templates.length === 0) && (
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={saving === "seed"}>
              {saving === "seed" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Load Defaults
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(!addOpen)}>
            <Plus className="h-4 w-4 mr-1" /> Add Template
          </Button>
        </div>
      </div>

      {/* Add new template form */}
      {addOpen && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name (e.g. Welcome Message)"
              className="font-medium text-sm"
            />
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your SMS message with {Variables}..."
              rows={3}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{charCount(newMessage)}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddNew} disabled={saving === "new" || !newName.trim() || !newMessage.trim()}>
                  {saving === "new" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save
                </Button>
              </div>
            </div>
            {newMessage && (
              <div className="rounded-md bg-muted/50 p-3 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                <p className="text-sm text-foreground">{previewMessage(newMessage)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {templates?.map((tpl) => {
        const edited = editForm[tpl.id] || { name: tpl.name, message: tpl.message };
        const previewing = showPreview[tpl.id];
        return (
          <Card key={tpl.id} className="transition-shadow hover:shadow-md">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={edited.name}
                  onChange={(e) => handleEdit(tpl.id, "name", e.target.value)}
                  className="font-medium text-sm max-w-xs"
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPreview((p) => ({ ...p, [tpl.id]: !p[tpl.id] }))}
                    title={previewing ? "Hide preview" : "Show preview"}
                  >
                    {previewing ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
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
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{charCount(edited.message)}</span>
              </div>
              {previewing && (
                <div className="rounded-md bg-muted/50 p-3 border border-border animate-fade-in">
                  <p className="text-xs font-medium text-muted-foreground mb-1">📱 Preview with sample data:</p>
                  <p className="text-sm text-foreground">{previewMessage(edited.message)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {templates && templates.length === 0 && !addOpen && (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No SMS templates yet. Click "Load Defaults" to add standard templates, or "Add Template" to create your own.</CardContent></Card>
      )}
    </div>
  );
}
