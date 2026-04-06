import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { postPaymentToLedger } from "@/lib/ledger";
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
import { usePermissions } from "@/hooks/usePermissions";
import { paymentsApi } from "@/lib/api";
import { useInvoiceFooter } from "@/hooks/useInvoiceFooter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Payments() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
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
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { data: invoiceFooter } = useInvoiceFooter();
  const canEditPayment = isSuperAdmin || hasPermission("payments", "edit");
  const canDeletePayment = isSuperAdmin || hasPermission("payments", "delete");

  // First get tenant customer IDs
  const { data: tenantCustomerIds } = useQuery({
    queryKey: ["tenant-customer-ids", tenantId],
    queryFn: async () => {
      let q = db.from("customers").select("id");
      if (tenantId) q = (q as any).eq("tenant_id", tenantId);
      const { data } = await q;
      return (data || []).map((c: any) => c.id) as string[];
    },
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin-payments", tenantId],
    queryFn: async () => {
      if (tenantCustomerIds && tenantCustomerIds.length === 0) return [];
      let query: any = db
        .from("payments")
        .select("*, customers(customer_id, name)")
        .order("created_at", { ascending: false });
      if (tenantCustomerIds) query = query.in("customer_id", tenantCustomerIds);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantCustomerIds,
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
    try {
      await paymentsApi.update(editPayment.id, newData);
      if (userId) await logAudit({ adminId: userId, adminName, action: "edit", tableName: "payments", recordId: editPayment.id, oldData: { amount: editPayment.amount, payment_method: editPayment.payment_method, transaction_id: editPayment.transaction_id, status: editPayment.status }, newData });
      toast.success("Payment updated successfully");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      // 1. Reverse customer ledger entries for this payment
      if (deleteTarget.customer_id) {
        await db.from("customer_ledger").delete()
          .eq("customer_id", deleteTarget.customer_id)
          .eq("type", "payment")
          .eq("reference", deleteTarget.id);
      }

      // 2. Reverse accounting ledger (transactions) entries
      const paymentRef = deleteTarget.transaction_id || `payment-${deleteTarget.payment_method}`;
      await db.from("transactions").delete()
        .eq("reference", paymentRef)
        .eq("type", "receipt");

      // 3. Update account balances: reverse debit on cash, reverse credit on income
      // Re-fetch to update balances correctly
      const { data: relatedTxns } = await db.from("transactions")
        .select("account_id, debit, credit")
        .eq("reference", paymentRef)
        .eq("type", "receipt");
      
      // If transactions were already deleted above, we need to reverse balances manually
      // We'll reverse the known amounts on the cash and income accounts
      if (deleteTarget.amount > 0) {
        const amount = Number(deleteTarget.amount);
        
        // Find and reverse cash account balance (was debited)
        const cashAccounts: Record<string, string> = {
          bkash: "1103", nagad: "1104", bank: "1102", cash: "1101",
        };
        const cashCode = cashAccounts[deleteTarget.payment_method] || "1101";
        const { data: cashAcc } = await db.from("accounts")
          .select("id, balance, type").eq("code", cashCode).maybeSingle();
        if (cashAcc) {
          await db.from("accounts").update({
            balance: Number(cashAcc.balance) - amount,
          }).eq("id", cashAcc.id);
        }

        // Find and reverse service income account balance (was credited)
        const { data: incomeAcc } = await db.from("accounts")
          .select("id, balance, type").eq("code", "4201").maybeSingle();
        if (incomeAcc) {
          await db.from("accounts").update({
            balance: Number(incomeAcc.balance) - amount,
          }).eq("id", incomeAcc.id);
        }
      }

      // 4. Revert bill status to unpaid if linked
      if (deleteTarget.bill_id) {
        await db.from("bills").update({
          status: "unpaid", paid_date: null,
        }).eq("id", deleteTarget.bill_id);
      }

      // 5. Recalculate customer ledger balance
      if (deleteTarget.customer_id) {
        const { data: ledgerEntries } = await db.from("customer_ledger")
          .select("id, debit, credit")
          .eq("customer_id", deleteTarget.customer_id)
          .order("created_at", { ascending: true });
        
        if (ledgerEntries) {
          let runningBalance = 0;
          for (const entry of ledgerEntries) {
            runningBalance += Number(entry.debit) - Number(entry.credit);
            await db.from("customer_ledger").update({ balance: runningBalance }).eq("id", entry.id);
          }
        }
      }

      // 6. Delete the payment record itself
      await paymentsApi.delete(deleteTarget.id);

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
      case "bkash": return "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800";
      case "nagad": return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800";
      case "bank": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800";
      case "cash": return "bg-success/10 text-success border-success/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t.payments.title}</h1>
         <p className="text-muted-foreground mt-1">{t.payments.title}</p>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t.payments.searchPlaceholder} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Select value={methodFilter} onValueChange={setMethodFilter}>
               <SelectTrigger><SelectValue placeholder={t.payments.paymentMethod} /></SelectTrigger>
               <SelectContent><SelectItem value="all">{t.payments.allMethods}</SelectItem><SelectItem value="bkash">{t.payments.bkash}</SelectItem><SelectItem value="nagad">{t.payments.nagad}</SelectItem><SelectItem value="bank">{t.payments.bank}</SelectItem><SelectItem value="cash">{t.payments.cash}</SelectItem></SelectContent>
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
                  <TableHead>{t.customers.customerId}</TableHead><TableHead>{t.common.name}</TableHead><TableHead>{t.common.amount}</TableHead><TableHead>{t.payments.paymentMethod}</TableHead><TableHead>{t.payments.transactionId}</TableHead><TableHead>{t.common.status}</TableHead><TableHead>{t.common.date}</TableHead><TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">{t.payments.noPaymentsFound}</TableCell></TableRow>
                ) : (
                  filtered?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.customers?.customer_id}</TableCell>
                      <TableCell className="font-medium">{payment.customers?.name}</TableCell>
                      <TableCell>৳{Number(payment.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={methodColor(payment.payment_method)}>{payment.payment_method}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{payment.transaction_id || payment.bkash_trx_id || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor(payment.status)}>{payment.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{safeFormat(payment.paid_at, "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditPayment && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              setEditPayment(payment); setEditAmount(payment.amount.toString()); setEditMethod(payment.payment_method);
                              setEditTrxId(payment.transaction_id || ""); setEditStatus(payment.status);
                              setEditDate(safeFormat(payment.paid_at, "yyyy-MM-dd'T'HH:mm")); setEditOpen(true);
                            }}><Pencil className="h-4 w-4" /></Button>
                          )}
                          {canDeletePayment && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(payment)}><Trash2 className="h-4 w-4" /></Button>
                          )}
                          {payment.status === "completed" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => generatePaymentReceiptPDF(payment, payment.customers, invoiceFooter)}><Download className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{t.payments.editPayment}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>{t.common.amount}</Label><Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t.payments.paymentMethod}</Label>
              <Select value={editMethod} onValueChange={setEditMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">{t.payments.cash}</SelectItem><SelectItem value="bkash">{t.payments.bkash}</SelectItem><SelectItem value="nagad">{t.payments.nagad}</SelectItem><SelectItem value="bank">{t.payments.bank}</SelectItem><SelectItem value="bkash_merchant">{t.payments.bkashMerchant}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>{t.payments.transactionId}</Label><Input value={editTrxId} onChange={(e) => setEditTrxId(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t.common.status}</Label>
              <Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="completed">{t.common.completed}</SelectItem><SelectItem value="pending">{t.common.pending}</SelectItem><SelectItem value="failed">{t.sms.failed}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>{t.common.date}</Label><Input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></div>
            <div className="flex justify-end"><Button onClick={handleEditSave}>{t.common.save}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onConfirm={handleDelete} loading={deleteLoading} />
    </DashboardLayout>
  );
}
