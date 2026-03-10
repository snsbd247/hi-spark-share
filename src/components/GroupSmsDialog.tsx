import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Users, FileText, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

type CustomerGroup = "all" | "due" | "paid" | "suspended" | "zone" | "package";

// SMS segment calculation
function getSmsInfo(text: string) {
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const charLimit = isUnicode ? 70 : 160;
  const multiPartLimit = isUnicode ? 67 : 153;
  const len = text.length;
  if (len === 0) return { chars: 0, segments: 0, charLimit, isUnicode };
  const segments = len <= charLimit ? 1 : Math.ceil(len / multiPartLimit);
  return { chars: len, segments, charLimit, isUnicode };
}

interface GroupSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

export default function GroupSmsDialog({ open, onOpenChange, onSent }: GroupSmsDialogProps) {
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<CustomerGroup>("all");
  const [zoneId, setZoneId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const smsInfo = useMemo(() => getSmsInfo(message), [message]);

  // Fetch zones
  const { data: zones = [] } = useQuery({
    queryKey: ["zones-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zones").select("id, area_name").eq("status", "active").order("area_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch packages
  const { data: packages = [] } = useQuery({
    queryKey: ["packages-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_templates").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch customers based on group
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ["group-sms-customers", group, zoneId, packageId],
    queryFn: async () => {
      let query = supabase.from("customers").select("id, name, phone, customer_id, area, package_id, connection_status");

      if (group === "suspended") {
        query = query.eq("connection_status", "suspended");
      } else if (group === "zone" && zoneId) {
        const zone = zones.find((z: any) => z.id === zoneId);
        if (zone) query = query.eq("area", zone.area_name);
      } else if (group === "package" && packageId) {
        query = query.eq("package_id", packageId);
      }

      if (group !== "suspended") {
        query = query.eq("status", "active");
      }

      const { data, error } = await query.order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && (group !== "zone" || !!zoneId) && (group !== "package" || !!packageId),
  });

  // For due/paid, we need bills data
  const { data: billFilteredCustomerIds } = useQuery({
    queryKey: ["group-sms-bills", group],
    queryFn: async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const status = group === "due" ? "unpaid" : "paid";
      const { data, error } = await supabase
        .from("bills")
        .select("customer_id")
        .eq("month", currentMonth)
        .eq("status", status);
      if (error) throw error;
      return new Set((data || []).map((b: any) => b.customer_id));
    },
    enabled: open && (group === "due" || group === "paid"),
  });

  const filteredCustomers = useMemo(() => {
    if (group === "due" || group === "paid") {
      if (!billFilteredCustomerIds) return [];
      return customers.filter((c: any) => billFilteredCustomerIds.has(c.id));
    }
    return customers;
  }, [customers, group, billFilteredCustomerIds]);

  const customerCount = filteredCustomers.length;
  const canSend = message.trim().length > 0 && customerCount > 0 && !sending;

  const handleSendClick = () => {
    if (!canSend) return;
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const batchSize = 10;
      for (let i = 0; i < filteredCustomers.length; i += batchSize) {
        const batch = filteredCustomers.slice(i, i + batchSize);
        const promises = batch.map(async (customer: any) => {
          try {
            const res = await fetch(
              `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-sms`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: customer.phone,
                  message,
                  sms_type: "group",
                  customer_id: customer.id,
                }),
              }
            );
            const data = await res.json();
            if (res.ok && data.success) successCount++;
            else failCount++;
          } catch {
            failCount++;
          }
        });
        await Promise.all(promises);
      }

      if (successCount > 0) {
        toast.success(`SMS sent to ${successCount} customers${failCount > 0 ? `, ${failCount} failed` : ""}`);
      } else {
        toast.error(`Failed to send SMS to all ${failCount} customers`);
      }

      setMessage("");
      setGroup("all");
      setZoneId("");
      setPackageId("");
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to send group SMS");
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !message.trim()) {
      toast.error("Template name and message are required");
      return;
    }
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from("sms_templates").insert({ name: templateName.trim(), message: message.trim() });
      if (error) throw error;
      toast.success("Template saved");
      setTemplateName("");
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase.from("sms_templates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["sms-templates"] });
    }
  };

  const resetForm = () => {
    setGroup("all");
    setZoneId("");
    setPackageId("");
    setMessage("");
    setTemplateName("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Send Group SMS
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Group */}
            <div>
              <Label>Customer Group</Label>
              <Select value={group} onValueChange={(v) => { setGroup(v as CustomerGroup); setZoneId(""); setPackageId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="due">Due Customers</SelectItem>
                  <SelectItem value="paid">Paid Customers</SelectItem>
                  <SelectItem value="suspended">Suspended Customers</SelectItem>
                  <SelectItem value="zone">Zone Based Customers</SelectItem>
                  <SelectItem value="package">Package Based Customers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zone filter */}
            {group === "zone" && (
              <div>
                <Label>Zone</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z: any) => (
                      <SelectItem key={z.id} value={z.id}>{z.area_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Package filter */}
            {group === "package" && (
              <div>
                <Label>Package</Label>
                <Select value={packageId} onValueChange={setPackageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Templates */}
            {templates.length > 0 && (
              <div>
                <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Load Template</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {templates.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMessage(t.message)}
                        className="text-xs"
                      >
                        {t.name}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteTemplate(t.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message */}
            <div>
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
              />
              {/* Character & segment counter */}
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>
                  {smsInfo.chars} character{smsInfo.chars !== 1 ? "s" : ""}
                  {smsInfo.isUnicode && " (Unicode)"}
                </span>
                <span>
                  {smsInfo.segments} SMS segment{smsInfo.segments !== 1 ? "s" : ""}
                  {smsInfo.segments > 1 && ` (${smsInfo.isUnicode ? 67 : 153} chars/segment)`}
                </span>
              </div>
            </div>

            {/* Save as template */}
            {message.trim().length > 0 && (
              <div className="flex items-center gap-2">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="flex-1 h-9 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                >
                  {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save
                </Button>
              </div>
            )}

            {/* Preview count */}
            <div className="flex items-center gap-2">
              {loadingCustomers ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Badge variant="secondary" className="text-sm py-1 px-3">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  {customerCount} customer{customerCount !== 1 ? "s" : ""} will receive this SMS
                </Badge>
              )}
            </div>

            {/* Send button */}
            <Button onClick={handleSendClick} disabled={!canSend} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {sending ? "Sending..." : "Send Group SMS"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmSend}
        loading={sending}
        title="Confirm Group SMS"
        description={`Are you sure you want to send SMS to ${customerCount} customer${customerCount !== 1 ? "s" : ""}? This action cannot be undone.`}
      />
    </>
  );
}
