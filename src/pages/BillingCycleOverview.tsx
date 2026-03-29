import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, Clock, CheckCircle, Users, Zap, Pencil, Trash2 } from "lucide-react";
import { format, subDays, isBefore } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { useAdminRole } from "@/hooks/useAdminRole";
import { logAudit } from "@/lib/auditLog";
import { useLanguage } from "@/contexts/LanguageContext";

type CustomerWithBill = {
  id: string;
  customer_id: string;
  name: string;
  phone: string;
  monthly_bill: number;
  due_date_day: number | null;
  connection_status: string;
  status: string;
  latestBill?: { id: string; month: string; amount: number; status: string; due_date: string | null; };
};

function getDueStatus(dueDay: number, billStatus?: string, billDueDate?: string | null) {
  const today = new Date();
  if (billStatus === "paid") return "paid";
  if (billDueDate) {
    const due = new Date(billDueDate);
    if (isBefore(due, today)) return "overdue";
    if (isBefore(subDays(due, 1), today)) return "due-tomorrow";
    if (isBefore(subDays(due, 5), today)) return "upcoming";
  }
  return "pending";
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "paid": return <Badge variant="outline" className="bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
    case "overdue": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
    case "due-tomorrow": return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />Due Tomorrow</Badge>;
    case "upcoming": return <Badge variant="outline" className="bg-accent text-accent-foreground"><Clock className="h-3 w-3 mr-1" />Upcoming</Badge>;
    default: return <Badge variant="outline" className="bg-muted text-muted-foreground">Pending</Badge>;
  }
}

export default function BillingCycleOverview() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentMonth = format(new Date(), "yyyy-MM");
  const { canEdit, adminName, userId } = useAdminRole();

  const [editOpen, setEditOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerWithBill | null>(null);
  const [editBillAmount, setEditBillAmount] = useState("");
  const [editBillStatus, setEditBillStatus] = useState("");
  const [editConnectionStatus, setEditConnectionStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CustomerWithBill | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const generateBills = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auto-bill-generate");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["billing-cycle-overview"] });
      toast({ title: "Bills Generated", description: `${data?.generated || 0} new bills created for ${currentMonth}.` });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["billing-cycle-overview", currentMonth],
    queryFn: async () => {
      const { data: customers, error: custErr } = await supabase.from("customers").select("id, customer_id, name, phone, monthly_bill, due_date_day, connection_status, status").eq("status", "active").order("due_date_day", { ascending: true });
      if (custErr) throw custErr;
      const { data: bills, error: billErr } = await supabase.from("bills").select("id, customer_id, month, amount, status, due_date").eq("month", currentMonth);
      if (billErr) throw billErr;
      const billMap = new Map<string, typeof bills[0]>();
      bills?.forEach(b => billMap.set(b.customer_id, b));
      return (customers || []).map(c => ({ ...c, latestBill: billMap.get(c.id) })) as CustomerWithBill[];
    },
  });

  const grouped = new Map<number, CustomerWithBill[]>();
  data?.forEach(c => { const day = c.due_date_day || 1; if (!grouped.has(day)) grouped.set(day, []); grouped.get(day)!.push(c); });
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);

  const stats = {
    total: data?.length || 0,
    paid: data?.filter(c => c.latestBill?.status === "paid").length || 0,
    overdue: data?.filter(c => getDueStatus(c.due_date_day || 1, c.latestBill?.status, c.latestBill?.due_date) === "overdue").length || 0,
    noBill: data?.filter(c => !c.latestBill).length || 0,
  };

  const handleEditSave = async () => {
    if (!editCustomer) return;
    try {
      const oldData: Record<string, any> = { connection_status: editCustomer.connection_status };
      const newData: Record<string, any> = { connection_status: editConnectionStatus };
      if (editCustomer.latestBill) {
        oldData.bill_amount = editCustomer.latestBill.amount;
        oldData.bill_status = editCustomer.latestBill.status;
        newData.bill_amount = parseFloat(editBillAmount);
        newData.bill_status = editBillStatus;
        const { error } = await supabase.from("bills").update({ amount: parseFloat(editBillAmount), status: editBillStatus, ...(editBillStatus === "paid" ? { paid_date: new Date().toISOString() } : {}) }).eq("id", editCustomer.latestBill.id);
        if (error) throw error;
      }
      const { error: custErr } = await supabase.from("customers").update({ connection_status: editConnectionStatus }).eq("id", editCustomer.id);
      if (custErr) throw custErr;
      if (userId) await logAudit({ adminId: userId, adminName, action: "edit", tableName: "billing_cycle", recordId: editCustomer.id, oldData, newData });
      sonnerToast.success("Record updated successfully");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["billing-cycle-overview"] });
    } catch (err: any) { sonnerToast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.latestBill) return;
    setDeleteLoading(true);
    try {
      await supabase.from("customer_ledger").delete().eq("reference", `BILL-${deleteTarget.latestBill.id.substring(0, 8)}`);
      const { error } = await supabase.from("bills").delete().eq("id", deleteTarget.latestBill.id);
      if (error) throw error;
      if (userId) await logAudit({ adminId: userId, adminName, action: "delete", tableName: "bills", recordId: deleteTarget.latestBill.id, oldData: { customer: deleteTarget.name, month: deleteTarget.latestBill.month, amount: deleteTarget.latestBill.amount } });
      sonnerToast.success("Bill deleted successfully");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["billing-cycle-overview"] });
    } catch (err: any) { sonnerToast.error(err.message); } finally { setDeleteLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Billing Cycle Overview</h1>
        <p className="text-muted-foreground mt-1">Customers grouped by due date for {format(new Date(), "MMMM yyyy")}</p>
      </div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => generateBills.mutate()} disabled={generateBills.isPending}>
          {generateBills.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}Generate Bills Now
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3"><Users className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total Active</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3"><CheckCircle className="h-5 w-5 text-success" /><div><p className="text-2xl font-bold">{stats.paid}</p><p className="text-xs text-muted-foreground">Paid</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><div><p className="text-2xl font-bold">{stats.overdue}</p><p className="text-xs text-muted-foreground">Overdue</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 flex items-center gap-3"><Clock className="h-5 w-5 text-warning" /><div><p className="text-2xl font-bold">{stats.noBill}</p><p className="text-xs text-muted-foreground">No Bill Yet</p></div></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : sortedGroups.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No active customers found</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(([day, customers]) => (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">{day}</span>
                  Due Date: {day}{day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"} of each month
                  <Badge variant="secondary" className="ml-auto">{customers.length} customers</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">ID</th><th className="text-left py-2 px-2 font-medium">Name</th><th className="text-left py-2 px-2 font-medium">Phone</th><th className="text-right py-2 px-2 font-medium">Bill</th><th className="text-center py-2 px-2 font-medium">Status</th><th className="text-center py-2 px-2 font-medium">Connection</th><th className="text-right py-2 px-2 font-medium">{t.common.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => {
                        const dueStatus = getDueStatus(c.due_date_day || 1, c.latestBill?.status, c.latestBill?.due_date);
                        return (
                          <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-2 font-mono text-xs cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>{c.customer_id}</td>
                            <td className="py-2 px-2 font-medium cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>{c.name}</td>
                            <td className="py-2 px-2 text-muted-foreground">{c.phone}</td>
                            <td className="py-2 px-2 text-right">৳{Number(c.latestBill?.amount || c.monthly_bill).toLocaleString()}</td>
                            <td className="py-2 px-2 text-center">{c.latestBill ? <StatusBadge status={dueStatus} /> : <Badge variant="outline" className="bg-muted text-muted-foreground">No Bill</Badge>}</td>
                            <td className="py-2 px-2 text-center"><Badge variant="outline" className={c.connection_status === "active" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>{c.connection_status}</Badge></td>
                            <td className="py-2 px-2 text-right">
                              {canEdit && (
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                                    e.stopPropagation();
                                    setEditCustomer(c); setEditBillAmount((c.latestBill?.amount || c.monthly_bill).toString());
                                    setEditBillStatus(c.latestBill?.status || "unpaid"); setEditConnectionStatus(c.connection_status); setEditOpen(true);
                                  }}><Pencil className="h-3.5 w-3.5" /></Button>
                                  {c.latestBill && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Billing Record</DialogTitle></DialogHeader>
          {editCustomer && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editCustomer.name} ({editCustomer.customer_id})</p>
              <div className="space-y-1.5"><Label>Bill Amount</Label><Input type="number" value={editBillAmount} onChange={(e) => setEditBillAmount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Bill Status</Label>
                <Select value={editBillStatus} onValueChange={setEditBillStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partial">Partial</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Connection Status</Label>
                <Select value={editConnectionStatus} onValueChange={setEditConnectionStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="pending_reactivation">Pending Reactivation</SelectItem></SelectContent></Select>
              </div>
              <div className="flex justify-end"><Button onClick={handleEditSave}>Save Changes</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteLoading} description="This will delete the bill for this customer. Related ledger entries will also be removed." />
    </DashboardLayout>
  );
}
