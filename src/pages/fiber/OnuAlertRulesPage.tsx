import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bell, Mail, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { onuAlertApi, type OnuAlertRule, type AlertEvent } from "@/lib/onuAlertApi";

const EVENT_OPTIONS: { value: AlertEvent; label: string }[] = [
  { value: "any", label: "Any (offline/LOS/dying-gasp)" },
  { value: "offline", label: "Offline" },
  { value: "los", label: "LOS (Loss of Signal)" },
  { value: "dying_gasp", label: "Dying Gasp" },
  { value: "signal_low", label: "Signal Low (rx threshold)" },
];

interface FormState {
  id?: string;
  name: string;
  event_type: AlertEvent;
  rx_threshold_db: string;
  cooldown_minutes: string;
  recipients_email: string;
  recipients_sms: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  is_active: boolean;
  auto_suspend_pppoe: boolean;
}

const empty: FormState = {
  name: "",
  event_type: "any",
  rx_threshold_db: "-25",
  cooldown_minutes: "30",
  recipients_email: "",
  recipients_sms: "",
  email_enabled: true,
  sms_enabled: false,
  is_active: true,
  auto_suspend_pppoe: false,
};

export default function OnuAlertRulesPage() {
  const [rules, setRules] = useState<OnuAlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRules(await onuAlertApi.listRules());
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load alert rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setOpen(true); };
  const openEdit = (r: OnuAlertRule) => {
    setForm({
      id: r.id,
      name: r.name,
      event_type: r.event_type,
      rx_threshold_db: r.rx_threshold_db != null ? String(r.rx_threshold_db) : "-25",
      cooldown_minutes: String(r.cooldown_minutes ?? 30),
      recipients_email: (r.recipients_email || []).join(", "),
      recipients_sms: (r.recipients_sms || []).join(", "),
      email_enabled: (r.channels || []).includes("email"),
      sms_enabled: (r.channels || []).includes("sms"),
      is_active: r.is_active,
      auto_suspend_pppoe: !!r.auto_suspend_pppoe,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const channels: ("email" | "sms")[] = [
      ...(form.email_enabled ? ["email" as const] : []),
      ...(form.sms_enabled ? ["sms" as const] : []),
    ];
    if (channels.length === 0) { toast.error("Select at least one channel"); return; }

    const payload = {
      name: form.name.trim(),
      event_type: form.event_type,
      rx_threshold_db: form.event_type === "signal_low" ? parseFloat(form.rx_threshold_db) : null,
      cooldown_minutes: Math.max(1, parseInt(form.cooldown_minutes || "30", 10)),
      recipients_email: form.recipients_email.split(",").map((s) => s.trim()).filter(Boolean),
      recipients_sms: form.recipients_sms.split(",").map((s) => s.trim()).filter(Boolean),
      channels,
      is_active: form.is_active,
      auto_suspend_pppoe: form.auto_suspend_pppoe,
    };

    setSaving(true);
    try {
      if (form.id) await onuAlertApi.updateRule(form.id, payload);
      else await onuAlertApi.createRule(payload);
      toast.success("Saved");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: OnuAlertRule) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    try {
      await onuAlertApi.deleteRule(r.id);
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" /> ONU Alert Rules
            </h1>
            <p className="text-sm text-muted-foreground">
              Email + SMS notifications for ONU offline / LOS / dying-gasp / low-signal events.
            </p>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Rule</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Active Rules</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Cooldown</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                ) : rules.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No rules yet</TableCell></TableRow>
                ) : rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><Badge variant="outline">{r.event_type}</Badge></TableCell>
                    <TableCell className="space-x-1">
                      {(r.channels || []).includes("email") && <Badge variant="secondary"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
                      {(r.channels || []).includes("sms") && <Badge variant="secondary"><MessageSquare className="h-3 w-3 mr-1" />SMS</Badge>}
                    </TableCell>
                    <TableCell>{r.cooldown_minutes}m</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(r.recipients_email?.length || 0)} email, {(r.recipients_sms?.length || 0)} sms
                    </TableCell>
                    <TableCell>
                      <Badge className={r.is_active ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground"}>
                        {r.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Edit" : "Create"} Alert Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Critical ONU offline" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Event</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v as AlertEvent })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cooldown (minutes)</Label>
                <Input type="number" value={form.cooldown_minutes} onChange={(e) => setForm({ ...form, cooldown_minutes: e.target.value })} />
              </div>
            </div>
            {form.event_type === "signal_low" && (
              <div>
                <Label>Rx Threshold (dBm) — fire if rx ≤ this</Label>
                <Input type="number" step="0.1" value={form.rx_threshold_db} onChange={(e) => setForm({ ...form, rx_threshold_db: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Email recipients (comma-separated)</Label>
              <Input value={form.recipients_email} onChange={(e) => setForm({ ...form, recipients_email: e.target.value })} placeholder="noc@example.com, ops@example.com" />
            </div>
            <div>
              <Label>SMS recipients (comma-separated phone numbers)</Label>
              <Input value={form.recipients_sms} onChange={(e) => setForm({ ...form, recipients_sms: e.target.value })} placeholder="017XXXXXXXX, 018XXXXXXXX" />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.email_enabled} onCheckedChange={(v) => setForm({ ...form, email_enabled: v })} /> Email</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.sms_enabled} onCheckedChange={(v) => setForm({ ...form, sms_enabled: v })} /> SMS</label>
              <label className="flex items-center gap-2 text-sm ml-auto"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Active</label>
            </div>
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <Switch
                  checked={form.auto_suspend_pppoe}
                  onCheckedChange={(v) => setForm({ ...form, auto_suspend_pppoe: v })}
                />
                <div>
                  <div className="font-medium">Auto-suspend customer PPPoE on this event</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    When ONU goes offline/LOS, automatically disable the linked customer's MikroTik PPPoE secret. Restored automatically when ONU comes back online. Use with caution.
                  </div>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
