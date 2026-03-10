import { useState } from "react";
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
import { FileText, Pencil, CheckCircle, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { useAdminRole } from "@/hooks/useAdminRole";
import { logAudit } from "@/lib/auditLog";

export default function Billing() {
  const [search, setSearch] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editBill, setEditBill] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editMonth, setEditMonth] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [genMonth, setGenMonth] = useState(format(new Date(), "yyyy-MM"));
  const [genLoading, setGenLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const queryClient = useQueryClient();
  const { canEdit, adminName, userId } = useAdminRole();

  const { data: bills, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*, customers(customer_id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = bills?.filter(
    (b) =>
      b.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.customers?.customer_id?.toLowerCase().includes(search.toLowerCase()) ||
      b.month.includes(search)
  );

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const { data: customers, error: custErr } = await supabase
        .from("customers")
        .select("id, name, phone, monthly_bill, due_date_day")
        .eq("status", "active");
      if (custErr) throw custErr;

      if (!customers?.length) {
        toast.info("No active customers to generate bills for");
        setGenLoading(false);
        return;
      }

      const { data: existing } = await supabase.from("bills").select("customer_id").eq("month", genMonth);
      const existingIds = new Set(existing?.map((b) => b.customer_id));
      const newBills = customers
        .filter((c) => !existingIds.has(c.id))
        .map((c) => {
          const dueDay = c.due_date_day || 15;
          const monthDate = new Date(genMonth + "-01");
          const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
          return { customer_id: c.id, month: genMonth, amount: c.monthly_bill, status: "unpaid" as const, due_date: dueDate.toISOString().split("T")[0] };
        });

      if (!newBills.length) {
        toast.info("Bills already generated for this month");
        setGenLoading(false);
        setGenerateOpen(false);
        return;
      }

      const { error } = await supabase.from("bills").insert(newBills);
      if (error) throw error;

      const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const billCustomers = customers.filter((c) => !existingIds.has(c.id));
      for (const cust of billCustomers) {
        fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-sms`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: cust.phone, message: `Dear ${cust.name}, your internet bill for ${genMonth} is ${cust.monthly_bill} BDT. Please pay before the due date to avoid service suspension.`, sms_type: "bill_generate", customer_id: cust.id }),
        }).catch(() => {});
      }

      toast.success(`Generated ${newBills.length} bills for ${genMonth}`);
      setGenerateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills-stats"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleMarkPaid = async (bill: any) => {
    const { error } = await supabase.from("bills").update({ status: "paid", paid_date: new Date().toISOString() }).eq("id", bill.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Bill marked as paid");
    queryClient.invalidateQueries({ queryKey: ["bills"] });
    queryClient.invalidateQueries({ queryKey: ["bills-stats"] });
  };

  const handleEditSave = async () => {
    if (!editBill) return;
    const newData = { month: editMonth, amount: parseFloat(editAmount), status: editStatus, ...(editStatus === "paid" && !editBill.paid_date ? { paid_date: new Date().toISOString() } : {}) };
    const { error } = await supabase.from("bills").update(newData).eq("id", editBill.id);
    if (error) { toast.error(error.message); return; }
    if (userId) await logAudit({ adminId: userId, adminName, action: "edit", tableName: "bills", recordId: editBill.id, oldData: { month: editBill.month, amount: editBill.amount, status: editBill.status }, newData });
    toast.success("Bill updated successfully");
    setEditOpen(false);
    queryClient.invalidateQueries({ queryKey: ["bills"] });
    queryClient.invalidateQueries({ queryKey: ["bills-stats"] });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await supabase.from("customer_ledger").delete().eq("reference", `BILL-${deleteTarget.id.substring(0, 8)}`);
      const { error } = await supabase.from("bills").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      if (userId) await logAudit({ adminId: userId, adminName, action: "delete", tableName: "bills", recordId: deleteTarget.id, oldData: { month: deleteTarget.month, amount: deleteTarget.amount, status: deleteTarget.status, customer: deleteTarget.customers?.name } });
      toast.success("Bill deleted successfully");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills-stats"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-success/10 text-success border-success/20";
      case "unpaid": return "bg-destructive/10 text-destructive border-destructive/20";
      case "partial": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1">Generate and manage customer bills</p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}><FileText className="h-4 w-4 mr-2" /> Generate Bills</Button>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search bills..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No bills found</TableCell></TableRow>
                ) : (
                  filtered?.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-mono text-sm">{bill.customers?.customer_id}</TableCell>
                      <TableCell className="font-medium">{bill.customers?.name}</TableCell>
                      <TableCell>{bill.month}</TableCell>
                      <TableCell>৳{Number(bill.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor(bill.status)}>{bill.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(bill.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                setEditBill(bill); setEditMonth(bill.month); setEditAmount(bill.amount.toString()); setEditStatus(bill.status); setEditOpen(true);
                              }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(bill)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {bill.status !== "paid" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => handleMarkPaid(bill)}><CheckCircle className="h-4 w-4" /></Button>
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

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Monthly Bills</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Month</Label><Input type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} /></div>
            <p className="text-sm text-muted-foreground">This will generate bills for all active customers who don't already have a bill for this month.</p>
            <div className="flex justify-end"><Button onClick={handleGenerate} disabled={genLoading}>{genLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Generate</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Bill</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Month</Label><Input type="month" value={editMonth} onChange={(e) => setEditMonth(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partial">Partial</SelectItem></SelectContent></Select>
            </div>
            <div className="flex justify-end"><Button onClick={handleEditSave}>Save Changes</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteLoading} />
    </DashboardLayout>
  );
}
