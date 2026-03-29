import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { postExpenseToLedger } from "@/lib/ledger";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Expense {
  id: string; category: string; amount: number; date: string;
  description: string; payment_method: string; reference: string; status: string;
}

const emptyExpense = { category: "utility", amount: 0, date: new Date().toISOString().split("T")[0], description: "", payment_method: "cash", reference: "" };
const categories = ["salary", "utility", "rent", "maintenance", "transport", "internet", "office", "purchase", "other"];

export default function Expenses() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyExpense);
  const [search, setSearch] = useState("");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("expenses").select("*").order("date", { ascending: false });
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (formData: any) => {
      if (editing) {
        const { error } = await ( supabase as any).from("expenses").update(formData).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await ( supabase as any).from("expenses").insert(formData);
        if (error) throw error;
        // Post to accounting ledger
        await postExpenseToLedger(formData.category, formData.amount, formData.description, formData.payment_method, formData.date);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["all-transactions-summary"] });
      toast.success(editing ? "Expense updated" : "Expense recorded & posted to ledger");
      closeDialog();
    },
    onError: () => toast.error("Failed to save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Find the expense to get its reference pattern for transaction cleanup
      const expense = expenses.find((e: Expense) => e.id === id);

      // Delete associated transactions by reference pattern
      if (expense) {
        const ref = `exp-${expense.category}`;
        // Find matching transactions to reverse account balances
        const { data: relatedTxns } = await (supabase as any).from("transactions")
          .select("id, account_id, debit, credit")
          .eq("reference", ref)
          .eq("date", expense.date);

        if (relatedTxns && relatedTxns.length > 0) {
          // Reverse account balances
          for (const txn of relatedTxns) {
            if (txn.account_id) {
              const { data: acc } = await (supabase as any).from("accounts").select("balance, type").eq("id", txn.account_id).maybeSingle();
              if (acc) {
                const isDebitNormal = ["asset", "expense"].includes(acc.type);
                const reversal = isDebitNormal ? -(Number(txn.debit) - Number(txn.credit)) : -(Number(txn.credit) - Number(txn.debit));
                await (supabase as any).from("accounts").update({ balance: Number(acc.balance) + reversal }).eq("id", txn.account_id);
              }
            }
          }
          // Delete the transactions
          const txnIds = relatedTxns.map((t: any) => t.id);
          await (supabase as any).from("transactions").delete().in("id", txnIds);
        }
      }

      const { error } = await (supabase as any).from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["all-transactions-summary"] });
      toast.success("Expense deleted & ledger reversed");
    },
  });

  const closeDialog = () => { setOpen(false); setEditing(null); setForm(emptyExpense); };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({ category: e.category, amount: e.amount, date: e.date, description: e.description || "", payment_method: e.payment_method || "cash", reference: e.reference || "" });
    setOpen(true);
  };

  const filtered = expenses.filter((e: Expense) =>
    e.category?.toLowerCase().includes(search.toLowerCase()) || e.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = expenses.reduce((s: number, e: Expense) => s + Number(e.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
            <p className="text-muted-foreground text-sm">Track and manage all business expenses</p>
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: +e.target.value})} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
                  <div><Label>Payment Method</Label>
                    <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="bkash">bKash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} placeholder="Receipt/reference number" /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
                  <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-destructive" />
              <div><p className="text-2xl font-bold">৳{totalExpenses.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Expenses</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No expenses found</TableCell></TableRow>
                ) : filtered.map((e: Expense) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{e.category}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{e.description}</TableCell>
                    <TableCell className="capitalize">{e.payment_method}</TableCell>
                    <TableCell className="text-right font-medium">৳{Number(e.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) remove.mutate(e.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
