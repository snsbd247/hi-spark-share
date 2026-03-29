import { useState, useEffect } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Search, Loader2, Link2, CheckCircle, AlertCircle, HelpCircle, XCircle, MessageSquareText, Copy, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { useAdminRole } from "@/hooks/useAdminRole";
import { logAudit } from "@/lib/auditLog";
import MerchantPaymentImport from "@/components/MerchantPaymentImport";
import { merchantPaymentsApi } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MerchantPayments() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [smsInfoOpen, setSmsInfoOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<any>(null);
  const [editForm, setEditForm] = useState({ transaction_id: "", sender_phone: "", amount: "", reference: "", status: "" });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const { canEdit, adminName, userId } = useAdminRole();

  useEffect(() => {
    const channel = supabase
      .channel("merchant-payments-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "merchant_payments" }, (payload) => {
        const p = payload.new as any;
        const statusLabel = p.status === "matched" ? "✅ Matched" : p.status === "manual_review" ? "⚠️ Needs Review" : "❓ Unmatched";
        toast.info(`New Merchant Payment Received`, { description: `TrxID: ${p.transaction_id} — ৳${Number(p.amount).toLocaleString()} — ${statusLabel}`, duration: 8000 });
        queryClient.invalidateQueries({ queryKey: ["merchant-payments"] });
        queryClient.invalidateQueries({ queryKey: ["bills"] });
        queryClient.invalidateQueries({ queryKey: ["payments"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const [form, setForm] = useState({ transaction_id: "", sender_phone: "", amount: "", reference: "", payment_date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
  const [matchCustomerId, setMatchCustomerId] = useState("");
  const [matchBillId, setMatchBillId] = useState("");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["merchant-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merchant_payments").select("*, customers:matched_customer_id(customer_id, name), bills:matched_bill_id(month, amount)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: unpaidBills } = useQuery({
    queryKey: ["unpaid-bills-for-match", matchCustomerId],
    enabled: !!matchCustomerId,
    queryFn: async () => {
      const { data: cust } = await supabase.from("customers").select("id, name, customer_id").eq("customer_id", matchCustomerId.toUpperCase().trim()).single();
      if (!cust) return [];
      const { data } = await supabase.from("bills").select("id, month, amount, status").eq("customer_id", cust.id).eq("status", "unpaid").order("created_at", { ascending: true });
      return data?.map((b) => ({ ...b, cust_uuid: cust.id })) || [];
    },
  });

  const filtered = payments?.filter((p) => {
    const matchesSearch = p.transaction_id?.toLowerCase().includes(search.toLowerCase()) || p.sender_phone?.includes(search) || p.reference?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAdd = async () => {
    if (!form.transaction_id || !form.sender_phone || !form.amount) { toast.error("Transaction ID, Phone, and Amount are required"); return; }
    setLoading(true);
    try {
      await merchantPaymentsApi.create({ transaction_id: form.transaction_id.trim(), sender_phone: form.sender_phone.trim(), amount: parseFloat(form.amount), reference: form.reference.trim() || undefined, payment_date: new Date(form.payment_date).toISOString() });
      toast.success("Merchant payment recorded — auto-matching applied");
      setAddOpen(false);
      setForm({ transaction_id: "", sender_phone: "", amount: "", reference: "", payment_date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
      queryClient.invalidateQueries({ queryKey: ["merchant-payments"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const handleManualMatch = async () => {
    if (!selectedPayment || !matchBillId) { toast.error("Please select a bill to match"); return; }
    setLoading(true);
    try {
      const bill = unpaidBills?.find((b) => b.id === matchBillId);
      if (!bill) throw new Error("Bill not found");
      await merchantPaymentsApi.match(selectedPayment.id, bill.id, bill.cust_uuid);
      toast.success("Payment manually matched successfully");
      setMatchOpen(false); setSelectedPayment(null); setMatchCustomerId(""); setMatchBillId("");
      queryClient.invalidateQueries({ queryKey: ["merchant-payments"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const handleReject = async (payment: any) => {
    if (!confirm("Are you sure you want to reject this transaction?")) return;
    try {
      await supabase.from("merchant_payments").update({ status: "rejected", notes: (payment.notes || "") + " | Rejected by admin" }).eq("id", payment.id);
      toast.success("Transaction rejected");
      queryClient.invalidateQueries({ queryKey: ["merchant-payments"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEditSave = async () => {
    if (!editPayment) return;
    setLoading(true);
    try {
      const newData = { transaction_id: editForm.transaction_id, sender_phone: editForm.sender_phone, amount: parseFloat(editForm.amount), reference: editForm.reference || null, status: editForm.status };
      const { error } = await supabase.from("merchant_payments").update(newData).eq("id", editPayment.id);
      if (error) throw error;
      if (userId) await logAudit({ adminId: userId, adminName, action: "edit", tableName: "merchant_payments", recordId: editPayment.id, oldData: { transaction_id: editPayment.transaction_id, sender_phone: editPayment.sender_phone, amount: editPayment.amount, status: editPayment.status }, newData });
      toast.success("Merchant payment updated");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["merchant-payments"] });
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("merchant_payments").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      if (userId) await logAudit({ adminId: userId, adminName, action: "delete", tableName: "merchant_payments", recordId: deleteTarget.id, oldData: { transaction_id: deleteTarget.transaction_id, sender_phone: deleteTarget.sender_phone, amount: deleteTarget.amount } });
      toast.success("Merchant payment deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["merchant-payments"] });
    } catch (err: any) { toast.error(err.message); } finally { setDeleteLoading(false); }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "matched": return <Badge variant="outline" className="bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" />Matched</Badge>;
      case "manual_review": return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><AlertCircle className="h-3 w-3 mr-1" />Review</Badge>;
      case "rejected": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="outline" className="bg-muted text-muted-foreground"><HelpCircle className="h-3 w-3 mr-1" />Unmatched</Badge>;
    }
  };

  const apiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sms-receiver`;
  const copyEndpoint = () => { navigator.clipboard.writeText(apiEndpoint); toast.success("API endpoint copied to clipboard"); };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Merchant Payments</h1>
          <p className="text-muted-foreground mt-1">Reconcile bKash merchant payments with customer bills</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSmsInfoOpen(true)}><MessageSquareText className="h-4 w-4 mr-2" /> SMS Gateway Setup</Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" /> Upload Excel</Button>
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
        </div>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by TrxID, phone, reference..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="matched">Matched</SelectItem><SelectItem value="unmatched">Unmatched</SelectItem><SelectItem value="manual_review">Manual Review</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Transaction ID</TableHead><TableHead>Sender Phone</TableHead><TableHead>Amount</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead>Matched Customer</TableHead><TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered?.length ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No merchant payments found</TableCell></TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm text-muted-foreground">{safeFormat(p.payment_date, "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-1">
                          {p.transaction_id}
                          {(p as any).sms_text && (
                            <Tooltip><TooltipTrigger><MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs"><p className="text-xs">{(p as any).sms_text}</p></TooltipContent></Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{p.sender_phone}</TableCell>
                      <TableCell>৳{Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">{p.reference || "—"}</TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell>{(p.customers as any)?.name ? `${(p.customers as any).name} (${(p.customers as any).customer_id})` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                setEditPayment(p);
                                setEditForm({ transaction_id: p.transaction_id, sender_phone: p.sender_phone, amount: p.amount.toString(), reference: p.reference || "", status: p.status });
                                setEditOpen(true);
                              }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                          {p.status !== "matched" && p.status !== "rejected" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedPayment(p); setMatchCustomerId(p.reference || ""); setMatchOpen(true); }}><Link2 className="h-4 w-4 mr-1" /> Match</Button>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleReject(p)}><XCircle className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Merchant Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Transaction ID *</Label><Input value={form.transaction_id} onChange={(e) => setForm({ ...form, transaction_id: e.target.value })} placeholder="e.g. TRX123456789" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Sender Phone *</Label><Input value={form.sender_phone} onChange={(e) => setForm({ ...form, sender_phone: e.target.value })} placeholder="01XXXXXXXXX" /></div>
              <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="space-y-1.5"><Label>Reference (Customer ID)</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. ISP-00001" /></div>
            <div className="space-y-1.5"><Label>Payment Date</Label><Input type="datetime-local" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">System will auto-match if the reference matches a customer ID and amount matches an unpaid bill.</p>
            <div className="flex justify-end"><Button onClick={handleAdd} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Record & Match</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog open={matchOpen} onOpenChange={setMatchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manual Match Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {selectedPayment && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">TrxID:</span> {selectedPayment.transaction_id}</p>
                <p><span className="text-muted-foreground">Amount:</span> ৳{Number(selectedPayment.amount).toLocaleString()}</p>
                <p><span className="text-muted-foreground">Phone:</span> {selectedPayment.sender_phone}</p>
                {selectedPayment.sms_text && <p className="text-xs text-muted-foreground italic mt-1">SMS: {selectedPayment.sms_text}</p>}
                {selectedPayment.notes && <p className="text-xs text-warning">{selectedPayment.notes}</p>}
              </div>
            )}
            <div className="space-y-1.5"><Label>Customer ID</Label><Input value={matchCustomerId} onChange={(e) => { setMatchCustomerId(e.target.value); setMatchBillId(""); }} placeholder="ISP-00001" /></div>
            {unpaidBills && unpaidBills.length > 0 && (
              <div className="space-y-1.5"><Label>Select Unpaid Bill</Label>
                <Select value={matchBillId} onValueChange={setMatchBillId}><SelectTrigger><SelectValue placeholder="Select a bill..." /></SelectTrigger><SelectContent>{unpaidBills.map((b) => (<SelectItem key={b.id} value={b.id}>{b.month} — ৳{Number(b.amount).toLocaleString()}</SelectItem>))}</SelectContent></Select>
              </div>
            )}
            {unpaidBills && unpaidBills.length === 0 && matchCustomerId && <p className="text-sm text-destructive">No unpaid bills found for this customer</p>}
            <div className="flex justify-end"><Button onClick={handleManualMatch} disabled={loading || !matchBillId}>{loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirm Match</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Merchant Payment Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Merchant Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Transaction ID</Label><Input value={editForm.transaction_id} onChange={(e) => setEditForm({ ...editForm, transaction_id: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Sender Phone</Label><Input value={editForm.sender_phone} onChange={(e) => setEditForm({ ...editForm, sender_phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Reference</Label><Input value={editForm.reference} onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unmatched">Unmatched</SelectItem><SelectItem value="matched">Matched</SelectItem><SelectItem value="manual_review">Manual Review</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select>
            </div>
            <div className="flex justify-end"><Button onClick={handleEditSave} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Gateway Setup Dialog */}
      <Dialog open={smsInfoOpen} onOpenChange={setSmsInfoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>SMS Gateway Setup</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">Configure your Android SMS Gateway or SMS Forwarding service to send incoming bKash merchant SMS to the API endpoint below.</p>
            <div className="space-y-1.5"><Label>API Endpoint</Label><div className="flex gap-2"><Input value={apiEndpoint} readOnly className="font-mono text-xs" /><Button variant="outline" size="icon" onClick={copyEndpoint}><Copy className="h-4 w-4" /></Button></div></div>
            <div className="space-y-1.5"><Label>Headers (Required)</Label><pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">{`Content-Type: application/json\nX-API-KEY: YOUR_SMS_RECEIVER_API_KEY`}</pre></div>
            <div className="space-y-1.5"><Label>Request Format (POST JSON)</Label><pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">{`{\n  "sms_text": "You have received Tk 800 from 017XXXXXXXX. TrxID: 9F3X4K. Reference: ISP-00001."\n}`}</pre></div>
            <div className="space-y-1.5"><Label>Compatible SMS Sources</Label><ul className="list-disc list-inside text-muted-foreground text-xs space-y-1"><li>Android SMS Gateway App</li><li>SMS Forwarding services</li><li>Any HTTP client that can POST JSON</li></ul></div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteLoading} />

      <MerchantPaymentImport open={importOpen} onOpenChange={setImportOpen} onComplete={() => {
        queryClient.invalidateQueries({ queryKey: ["merchant-payments"] });
        queryClient.invalidateQueries({ queryKey: ["bills"] });
        queryClient.invalidateQueries({ queryKey: ["payments"] });
      }} />
    </DashboardLayout>
  );
}
