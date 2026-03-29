import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SupplierPayments() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", amount: "", payment_method: "cash", reference: "", notes: "" });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: async () => { const { data } = await ( supabase as any).from("suppliers").select("*"); return data || []; } });
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["supplier_payments"], queryFn: async () => { const { data } = await ( supabase as any).from("supplier_payments").select("*").order("paid_date", { ascending: false }); return data || []; } });

  const save = useMutation({
    mutationFn: async () => { await ( supabase as any).from("supplier_payments").insert({ ...form, amount: Number(form.amount), paid_date: new Date().toISOString() }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supplier_payments"] }); toast.success("Payment recorded"); setOpen(false); setForm({ supplier_id: "", amount: "", payment_method: "cash", reference: "", notes: "" }); },
    onError: () => toast.error("Failed"),
  });

  const getSupName = (id: string) => suppliers.find((s: any) => s.id === id)?.name || "—";
  const total = rows.reduce((s: number, r: any) => s + Number(r.amount), 0);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Supplier Payments</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}><SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger><SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="bkash">bKash</SelectItem></SelectContent></Select>
              <Input placeholder="Reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={() => save.mutate()} disabled={!form.supplier_id || !form.amount || save.isPending} className="w-full">{save.isPending ? "Saving..." : "Record Payment"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle>Payments (Total: ৳{total.toLocaleString()})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}><TableCell>{safeFormat(r.paid_date, "dd MMM yyyy")}</TableCell><TableCell className="font-medium">{getSupName(r.supplier_id)}</TableCell><TableCell className="font-semibold">৳{Number(r.amount).toLocaleString()}</TableCell><TableCell><Badge variant="outline">{r.payment_method}</Badge></TableCell><TableCell>{r.reference || "—"}</TableCell><TableCell>{r.notes || "—"}</TableCell></TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No payments</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
