import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { safeFormat } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, FileDown, Trash2 } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { generateTransactionVoucherPDF } from "@/lib/accountingPdf";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AllTransactions() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editTxn, setEditTxn] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("transactions").select("*").order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("accounts").select("*");
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (txn: any) => {
      const { data, error } = await (supabase as any).from("transactions").update({
        type: txn.type,
        debit: Number(txn.debit),
        credit: Number(txn.credit),
        date: txn.date,
        description: txn.description,
        account_id: txn.account_id || null,
      }).eq("id", txn.id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaction updated successfully");
      setEditTxn(null);
    },
    onError: () => toast.error("Failed to update transaction"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find the transaction to reverse account balance
      const txn = transactions.find((t: any) => t.id === id);
      if (txn?.account_id) {
        const acc = accounts.find((a: any) => a.id === txn.account_id);
        if (acc) {
          const isDebitNormal = ["asset", "expense"].includes(acc.type);
          const balanceChange = isDebitNormal
            ? -(Number(txn.debit) - Number(txn.credit))
            : -(Number(txn.credit) - Number(txn.debit));
          await (supabase as any).from("accounts").update({ balance: acc.balance + balanceChange }).eq("id", acc.id);
        }
      }
      const { error } = await (supabase as any).from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-flat"] });
      queryClient.invalidateQueries({ queryKey: ["all-transactions-summary"] });
      toast.success("Transaction deleted successfully");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete transaction"),
  });

  const getAccName = (id: string) => {
    const a = accounts.find((x: any) => x.id === id);
    return a ? `${a.code} - ${a.name}` : "—";
  };

  const totalDebit = transactions.reduce((s: number, t: any) => s + Number(t.debit), 0);
  const totalCredit = transactions.reduce((s: number, t: any) => s + Number(t.credit), 0);

  const openEdit = (t: any) => {
    setEditForm({
      id: t.id,
      type: t.type,
      debit: t.debit,
      credit: t.credit,
      date: t.date?.split("T")[0] || "",
      description: t.description || "",
      account_id: t.account_id || "",
    });
    setEditTxn(t);
  };

  const handleDownloadVoucher = (t: any) => {
    const account = accounts.find((a: any) => a.id === t.account_id);
    generateTransactionVoucherPDF(t, account);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">All Transactions</h1>
        <div className="flex gap-4 text-sm">
          <span className="font-medium">Total Debit: <span className="text-destructive">৳{totalDebit.toLocaleString()}</span></span>
          <span className="font-medium">Total Credit: <span className="text-green-600">৳{totalCredit.toLocaleString()}</span></span>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Transaction Ledger ({transactions.length} entries)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>{safeFormat(t.date, "dd MMM yyyy")}</TableCell>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell className="text-sm">{getAccName(t.account_id)}</TableCell>
                    <TableCell><Badge variant="outline">{t.reference || "—"}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{Number(t.debit) > 0 ? `৳${Number(t.debit).toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{Number(t.credit) > 0 ? `৳${Number(t.credit).toLocaleString()}` : "—"}</TableCell>
                    <TableCell><Badge variant={t.type === "income" ? "default" : "secondary"}>{t.type}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadVoucher(t)} title="Download Voucher">
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(t.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No transactions</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTxn} onOpenChange={(open) => !open && setEditTxn(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="journal">Journal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Debit</Label>
                <Input type="number" step="0.01" value={editForm.debit || ""} onChange={(e) => setEditForm({ ...editForm, debit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Credit</Label>
                <Input type="number" step="0.01" value={editForm.credit || ""} onChange={(e) => setEditForm({ ...editForm, credit: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={editForm.date || ""} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={editForm.account_id || "none"} onValueChange={(v) => setEditForm({ ...editForm, account_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {accounts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTxn(null)}>{t.common.cancel}</Button>
            <Button onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Transaction"
        description="এই ট্রানজাকশন ডিলিট করলে সংশ্লিষ্ট অ্যাকাউন্টের ব্যালেন্সও আপডেট হবে। আপনি কি নিশ্চিত?"
        loading={deleteMutation.isPending}
      />
    </DashboardLayout>
  );
}
