import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { postPaymentToLedger } from "@/lib/ledger";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import BillingImport from "@/components/BillingImport";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { billsApi } from "@/lib/api";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, Pencil, CheckCircle, Loader2, Search, Trash2, Upload,
  Calendar, Users, ArrowLeft, Printer, ChevronRight, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { useAdminRole } from "@/hooks/useAdminRole";
import { logAudit } from "@/lib/auditLog";
import { usePermissions } from "@/hooks/usePermissions";
import { generateBillInvoicePDF } from "@/lib/billPdf";

export default function Billing() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
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
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const { canEdit, adminName, userId } = useAdminRole();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreateBill = isSuperAdmin || hasPermission("billing", "create");
  const canEditBill = isSuperAdmin || hasPermission("billing", "edit");
  const canDeleteBill = isSuperAdmin || hasPermission("billing", "delete");

  const { data: bills, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*, customers(customer_id, name, phone, area, monthly_bill, package_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group bills by month
  const monthGroups = bills?.reduce((acc: Record<string, any[]>, bill) => {
    const month = bill.month || "unknown";
    if (!acc[month]) acc[month] = [];
    acc[month].push(bill);
    return acc;
  }, {}) || {};

  const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

  const getMonthStats = (monthBills: any[]) => {
    const total = monthBills.length;
    const paid = monthBills.filter(b => b.status === "paid").length;
    const unpaid = monthBills.filter(b => b.status === "unpaid").length;
    const partial = monthBills.filter(b => b.status === "partial").length;
    const totalAmount = monthBills.reduce((s, b) => s + Number(b.amount), 0);
    const paidAmount = monthBills.filter(b => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0);
    return { total, paid, unpaid, partial, totalAmount, paidAmount };
  };

  const formatMonthLabel = (month: string) => {
    try {
      const d = new Date(month + "-01");
      return format(d, "MMMM yyyy");
    } catch { return month; }
  };

  // Filter bills for selected month
  const selectedBills = selectedMonth ? (monthGroups[selectedMonth] || []) : [];
  const filteredBills = selectedBills.filter(
    (b) =>
      b.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.customers?.customer_id?.toLowerCase().includes(search.toLowerCase()) ||
      b.customers?.phone?.includes(search)
  );

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const result = await billsApi.generate(genMonth);
      toast.success(`Generated ${result.generated} bills for ${genMonth}`);
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
    try {
      const { error } = await supabase
        .from("bills")
        .update({ status: "paid", paid_date: new Date().toISOString() })
        .eq("id", bill.id);
      if (error) throw error;

      // Also create a payment record
      await supabase.from("payments").insert({
        customer_id: bill.customer_id,
        bill_id: bill.id,
        amount: Number(bill.amount),
        month: bill.month,
        payment_method: "cash",
        paid_at: new Date().toISOString(),
        status: "completed",
      });

      const customerName = bill.customers?.name || "Customer";
      await postPaymentToLedger(customerName, Number(bill.amount), "cash", undefined, new Date().toISOString());
      toast.success("Bill marked as paid & posted to ledger");
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills-stats"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditSave = async () => {
    if (!editBill) return;
    const newData = { month: editMonth, amount: parseFloat(editAmount), status: editStatus, ...(editStatus === "paid" && !editBill.paid_date ? { paid_date: new Date().toISOString() } : {}) };
    try {
      await billsApi.update(editBill.id, newData);
      if (userId) await logAudit({ adminId: userId, adminName, action: "edit", tableName: "bills", recordId: editBill.id, oldData: { month: editBill.month, amount: editBill.amount, status: editBill.status }, newData });
      toast.success("Bill updated successfully");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await billsApi.delete(deleteTarget.id);
      if (userId) await logAudit({ adminId: userId, adminName, action: "delete", tableName: "bills", recordId: deleteTarget.id, oldData: { month: deleteTarget.month, amount: deleteTarget.amount, status: deleteTarget.status, customer: deleteTarget.customers?.name } });
      toast.success("Bill deleted successfully");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePrintBill = async (bill: any) => {
    await generateBillInvoicePDF(bill, bill.customers);
  };

  const handlePrintAll = async () => {
    if (!filteredBills.length) return;
    for (const bill of filteredBills) {
      await generateBillInvoicePDF(bill, bill.customers);
    }
    toast.success(`${filteredBills.length} invoices generated`);
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
          {selectedMonth ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedMonth(null); setSearch(""); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{formatMonthLabel(selectedMonth)}</h1>
                <p className="text-muted-foreground mt-1">{selectedBills.length} bills generated</p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-foreground">Billing</h1>
              <p className="text-muted-foreground mt-1">Generate and manage customer bills</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {selectedMonth && (
            <Button variant="outline" onClick={handlePrintAll}>
              <Printer className="h-4 w-4 mr-2" /> Print All
            </Button>
          )}
          {!selectedMonth && canCreateBill && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" /> Upload Excel</Button>
              <Button onClick={() => setGenerateOpen(true)}><FileText className="h-4 w-4 mr-2" /> Generate Bills</Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !selectedMonth ? (
        /* ===== Monthly Bills List ===== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMonths.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-16">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No bills generated yet</p>
              <p className="text-sm mt-1">Click "Generate Bills" to create monthly bills</p>
            </div>
          ) : (
            sortedMonths.map((month) => {
              const stats = getMonthStats(monthGroups[month]);
              const paidPercent = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;
              return (
                <Card
                  key={month}
                  className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
                  onClick={() => setSelectedMonth(month)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{formatMonthLabel(month)}</h3>
                          <p className="text-xs text-muted-foreground">{month}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{stats.total} customers</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-success rounded-full transition-all"
                        style={{ width: `${paidPercent}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-success/10">
                        <p className="text-lg font-bold text-success">{stats.paid}</p>
                        <p className="text-[10px] text-success/80">Paid</p>
                      </div>
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <p className="text-lg font-bold text-destructive">{stats.unpaid}</p>
                        <p className="text-[10px] text-destructive/80">Unpaid</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted">
                        <p className="text-lg font-bold text-foreground">৳{(stats.totalAmount / 1000).toFixed(1)}k</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* ===== Selected Month Detail ===== */
        <div className="glass-card rounded-xl">
          {/* Summary bar */}
          {(() => {
            const stats = getMonthStats(selectedBills);
            return (
              <div className="p-4 border-b border-border grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="text-center p-2">
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Bills</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-2xl font-bold text-success">{stats.paid}</p>
                  <p className="text-xs text-muted-foreground">Paid</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-2xl font-bold text-destructive">{stats.unpaid}</p>
                  <p className="text-xs text-muted-foreground">Unpaid</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-2xl font-bold text-foreground">৳{stats.totalAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Billed</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-2xl font-bold text-success">৳{stats.paidAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Collected</p>
                </div>
              </div>
            );
          })()}

          <div className="p-4 border-b border-border">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, ID, or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No bills found</TableCell></TableRow>
                ) : (
                  filteredBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-mono text-sm">{bill.customers?.customer_id}</TableCell>
                      <TableCell className="font-medium">{bill.customers?.name}</TableCell>
                      <TableCell className="text-sm">{bill.customers?.phone}</TableCell>
                      <TableCell className="text-sm">{bill.customers?.area}</TableCell>
                      <TableCell className="font-semibold">৳{Number(bill.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor(bill.status)}>{bill.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{bill.due_date ? safeFormat(bill.due_date, "dd MMM yyyy") : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Print Invoice" onClick={() => handlePrintBill(bill)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          {canEditBill && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              setEditBill(bill); setEditMonth(bill.month); setEditAmount(bill.amount.toString()); setEditStatus(bill.status); setEditOpen(true);
                            }}><Pencil className="h-4 w-4" /></Button>
                          )}
                          {canDeleteBill && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(bill)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {bill.status !== "paid" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => handleMarkPaid(bill)} title="Mark as Paid">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Generate Dialog */}
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

      {/* Edit Dialog */}
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

      <BillingImport open={importOpen} onOpenChange={setImportOpen} onComplete={() => {
        queryClient.invalidateQueries({ queryKey: ["bills"] });
        queryClient.invalidateQueries({ queryKey: ["bills-stats"] });
      }} />
    </DashboardLayout>
  );
}
