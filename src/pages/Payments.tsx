import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Download, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { generatePaymentReceiptPDF } from "@/lib/pdf";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { useAdminRole } from "@/hooks/useAdminRole";
import { logAudit } from "@/lib/auditLog";

export default function Payments() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [editPayment, setEditPayment] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editTrxId, setEditTrxId] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDate, setEditDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const queryClient = useQueryClient();
  const { canEdit, adminName, userId } = useAdminRole();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, customers(customer_id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = payments?.filter((p) => {
    const matchSearch = !search || p.customers?.name?.toLowerCase().includes(search.toLowerCase()) || p.customers?.customer_id?.toLowerCase().includes(search.toLowerCase()) || p.transaction_id?.toLowerCase().includes(search.toLowerCase());
    const matchMethod = methodFilter === "all" || p.payment_method === methodFilter;
    const paidDate = new Date(p.paid_at);
    const matchFrom = !dateFrom || paidDate >= new Date(dateFrom);
    const matchTo = !dateTo || paidDate <= new Date(dateTo + "T23:59:59");
    return matchSearch && matchMethod && matchFrom && matchTo;
  });

  const handleEditSave = async () => {
    if (!editPayment) return;
    const newData = { amount: parseFloat(editAmount), payment_method: editMethod, transaction_id: editTrxId || null, status: editStatus, paid_at: new Date(editDate).toISOString() };
    const { error } = await supabase.from("payments").update(newData).eq("id", editPayment.id);
    if (error) { toast.error(error.message); return; }
    if (userId) await logAudit({ adminId: userId, adminName, action: "edit", tableName: "payments", recordId: editPayment.id, oldData: { amount: editPayment.amount, payment_method: editPayment.payment_method, transaction_id: editPayment.transaction_id, status: editPayment.status }, newData });
    toast.success("Payment updated successfully");
    setEditOpen(false);
    queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const ref = deleteTarget.transaction_id ? `TXN-${deleteTarget.transaction_id}` : `PAY-${deleteTarget.id.substring(0, 8)}`;
      await supabase.from("customer_ledger").delete().eq("reference", ref);
      const { error } = await supabase.from("payments").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      if (userId) await logAudit({ adminId: userId, adminName, action: "delete", tableName: "payments", recordId: deleteTarget.id, oldData: { amount: deleteTarget.amount, payment_method: deleteTarget.payment_method, customer: deleteTarget.customers?.name } });
      toast.success("Payment deleted successfully");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch (err: any) { toast.error(err.message); } finally { setDeleteLoading(false); }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/10 text-success border-success/20";
      case "pending": return "bg-warning/10 text-warning border-warning/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const methodColor = (method: string) => {
    switch (method) {
      case "bkash": return "bg-pink-50 text-pink-700 border-pink-200";
      case "nagad": return "bg-orange-50 text-orange-700 border-orange-200";
      case "bank": return "bg-blue-50 text-blue-700 border-blue-200";
      case "cash": return "bg-green-50 text-green-700 border-green-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground mt-1">View and filter all payment transactions</p>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customer or TrxID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger><SelectValue placeholder="Payment method" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="bkash">bKash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="cash">Cash</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Transaction ID</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No payments found</TableCell></TableRow>
                ) : (
                  filtered?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.customers?.customer_id}</TableCell>
                      <TableCell className="font-medium">{payment.customers?.name}</TableCell>
                      <TableCell>৳{Number(payment.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={methodColor(payment.payment_method)}>{payment.payment_method}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{payment.transaction_id || payment.bkash_trx_id || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor(payment.status)}>{payment.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(payment.paid_at), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                setEditPayment(payment); setEditAmount(payment.amount.toString()); setEditMethod(payment.payment_method);
                                setEditTrxId(payment.transaction_id || ""); setEditStatus(payment.status);
                                setEditDate(format(new Date(payment.paid_at), "yyyy-MM-dd'T'HH:mm")); setEditOpen(true);
                              }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(payment)}><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                          {payment.status === "completed" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => generatePaymentReceiptPDF(payment, payment.customers)}><Download className="h-4 w-4" /></Button>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Payment Method</Label>
              <Select value={editMethod} onValueChange={setEditMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bkash">bKash</SelectItem><SelectItem value="nagad">Nagad</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="bkash_merchant">bKash Merchant</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Transaction ID</Label><Input value={editTrxId} onChange={(e) => setEditTrxId(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></div>
            <div className="flex justify-end"><Button onClick={handleEditSave}>Save Changes</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteLoading} />
    </DashboardLayout>
  );
}
