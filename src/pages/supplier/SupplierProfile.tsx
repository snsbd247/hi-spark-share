import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Printer, Loader2, Phone, Mail, MapPin, Receipt, Wallet, ShoppingCart, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { generatePaymentAdvicePDF } from "@/lib/accountingPdf";
import { generateSupplierPurchaseInvoicePDF } from "@/lib/supplierPurchasePdf";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SupplierProfile() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", payment_method: "cash", reference: "", notes: "", purchase_id: "" });

  // Edit purchase state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", paid_amount: 0, notes: "" });
  const [editItems, setEditItems] = useState<any[]>([]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("products").select("id, name, sku, buy_price").order("name");
      return data || [];
    },
  });

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("suppliers").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["supplier-payments", id],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("supplier_payments").select("*").eq("supplier_id", id!).order("paid_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["supplier-purchases", id],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("purchases").select("*").eq("supplier_id", id!).order("date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const totalPurchase = purchases.reduce((s: number, p: any) => s + Number(p.total_amount), 0);
  const totalPaid = purchases.reduce((s: number, p: any) => s + Number(p.paid_amount), 0);
  const totalDue = totalPurchase - totalPaid;

  // Ledger entries: combine purchases (debit) and payments (credit)
  const ledgerEntries = [
    ...purchases.map((p: any) => ({ date: p.date, description: `Purchase #${p.purchase_no}`, debit: Number(p.total_amount), credit: 0, ref: p.purchase_no, type: "purchase" })),
    ...payments.map((p: any) => ({ date: p.paid_date, description: `Payment - ${p.payment_method}`, debit: 0, credit: Number(p.amount), ref: p.reference || "—", type: "payment" })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  const ledgerWithBalance = ledgerEntries.map(e => {
    runningBalance += e.debit - e.credit;
    return { ...e, balance: runningBalance };
  });

  const unpaidPurchases = purchases.filter((p: any) => Number(p.total_amount) > Number(p.paid_amount));

  const savePay = useMutation({
    mutationFn: async () => {
      const amount = Number(payForm.amount);
      await ( supabase as any).from("supplier_payments").insert({
        supplier_id: id,
        amount,
        payment_method: payForm.payment_method,
        reference: payForm.reference || null,
        notes: payForm.notes || null,
        purchase_id: payForm.purchase_id || null,
        paid_date: new Date().toISOString(),
      });
      // Update purchase paid_amount if linked
      if (payForm.purchase_id) {
        const purchase = purchases.find((p: any) => p.id === payForm.purchase_id);
        if (purchase) {
          const newPaid = Number(purchase.paid_amount) + amount;
          const newStatus = newPaid >= Number(purchase.total_amount) ? "paid" : "partial";
          await ( supabase as any).from("purchases").update({ paid_amount: newPaid, status: newStatus }).eq("id", payForm.purchase_id);
        }
      }
      // Update supplier total_due
      await ( supabase as any).from("suppliers").update({ total_due: Math.max(0, totalDue - amount) }).eq("id", id!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-payments", id] });
      qc.invalidateQueries({ queryKey: ["supplier-purchases", id] });
      qc.invalidateQueries({ queryKey: ["supplier", id] });
      toast.success("Payment recorded");
      // Generate payment advice
      const lastPayment = { amount: Number(payForm.amount), payment_method: payForm.payment_method, reference: payForm.reference, date: new Date().toISOString(), purchase_no: purchases.find((p: any) => p.id === payForm.purchase_id)?.purchase_no };
      generatePaymentAdvicePDF(supplier, lastPayment, totalDue - Number(payForm.amount));
      setPayOpen(false);
      setPayForm({ amount: "", payment_method: "cash", reference: "", notes: "", purchase_id: "" });
    },
    onError: () => toast.error("Payment failed"),
  });

  // Print purchase invoice
  const handlePrintPurchase = async (p: any) => {
    const { data: pItems } = await (supabase as any).from("purchase_items").select("*, products(name, sku)").eq("purchase_id", p.id);
    generateSupplierPurchaseInvoicePDF(p, supplier, pItems || []);
  };

  // Open edit purchase
  const handleEditPurchase = async (p: any) => {
    setEditId(p.id);
    setEditForm({ date: p.date?.split("T")[0] || "", paid_amount: Number(p.paid_amount), notes: p.notes || "" });
    const { data: pItems } = await (supabase as any).from("purchase_items").select("*").eq("purchase_id", p.id);
    setEditItems(pItems?.length ? pItems.map((i: any) => ({ product_id: i.product_id || "", description: i.description || "", quantity: Number(i.quantity), unit_price: Number(i.unit_price) })) : [{ product_id: "", description: "", quantity: 1, unit_price: 0 }]);
    setEditOpen(true);
  };

  // Save edit
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const total = editItems.reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
      const status = editForm.paid_amount >= total ? "paid" : editForm.paid_amount > 0 ? "partial" : "unpaid";
      await (supabase as any).from("purchases").update({ date: editForm.date, total_amount: total, paid_amount: editForm.paid_amount, status, notes: editForm.notes || null }).eq("id", editId);
      await (supabase as any).from("purchase_items").delete().eq("purchase_id", editId);
      const newItems = editItems.filter((i: any) => i.product_id || i.description).map((i: any) => ({ purchase_id: editId, product_id: i.product_id || null, description: i.description || null, quantity: i.quantity, unit_price: i.unit_price }));
      if (newItems.length) await (supabase as any).from("purchase_items").insert(newItems);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-purchases", id] });
      toast.success("Purchase updated");
      setEditOpen(false);
    },
    onError: () => toast.error("Update failed"),
  });

  if (isLoading) return <DashboardLayout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  if (!supplier) return <DashboardLayout><p className="text-center py-20 text-muted-foreground">Supplier not found</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/supplier/list")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{supplier.name}</h1>
            <p className="text-muted-foreground text-sm">{supplier.company || "Supplier Profile"}</p>
          </div>
          <Button onClick={() => setPayOpen(true)}><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Purchase</p>
            <p className="text-lg font-bold">৳{totalPurchase.toLocaleString()}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-lg font-bold text-success">৳{totalPaid.toLocaleString()}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Due</p>
            <p className="text-lg font-bold text-destructive">৳{totalDue.toLocaleString()}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 space-y-1">
            {supplier.phone && <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> {supplier.phone}</p>}
            {supplier.email && <p className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> {supplier.email}</p>}
            {supplier.address && <p className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> {supplier.address}</p>}
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ledger">
          <TabsList>
            <TabsTrigger value="ledger" className="gap-1"><Receipt className="h-3.5 w-3.5" /> Ledger</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1"><Wallet className="h-3.5 w-3.5" /> Payments</TabsTrigger>
            <TabsTrigger value="purchases" className="gap-1"><ShoppingCart className="h-3.5 w-3.5" /> Purchases</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger">
            <Card>
              <CardHeader><CardTitle className="text-base">Supplier Ledger</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Ref</TableHead>
                    <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {ledgerWithBalance.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No entries</TableCell></TableRow>
                    ) : ledgerWithBalance.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{safeFormat(e.date, "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-sm">{e.description}</TableCell>
                        <TableCell className="text-sm font-mono">{e.ref}</TableCell>
                        <TableCell className="text-right text-sm">{e.debit > 0 ? `৳${e.debit.toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-right text-sm text-success">{e.credit > 0 ? `৳${e.credit.toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">৳{e.balance.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead><TableHead>Invoice</TableHead><TableHead>Notes</TableHead><TableHead>Advice</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payments</TableCell></TableRow>
                    ) : payments.map((p: any) => {
                      const linkedPurchase = purchases.find((pu: any) => pu.id === p.purchase_id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{safeFormat(p.paid_date, "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-sm font-semibold">৳{Number(p.amount).toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell>
                          <TableCell className="text-sm">{p.reference || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{linkedPurchase?.purchase_no || "—"}</TableCell>
                          <TableCell className="text-sm">{p.notes || "—"}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => generatePaymentAdvicePDF(supplier, { ...p, purchase_no: linkedPurchase?.purchase_no }, totalDue)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases">
            <Card>
              <CardHeader><CardTitle className="text-base">Purchase History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Invoice #</TableHead><TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {purchases.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchases</TableCell></TableRow>
                    ) : purchases.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{safeFormat(p.date, "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-sm font-mono">{p.purchase_no}</TableCell>
                        <TableCell className="text-sm font-semibold">৳{Number(p.total_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-success">৳{Number(p.paid_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-destructive">৳{(Number(p.total_amount) - Number(p.paid_amount)).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "paid" ? "default" : p.status === "partial" ? "secondary" : "destructive"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" title="Print Invoice" onClick={() => handlePrintPurchase(p)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Edit" onClick={() => handleEditPurchase(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Supplier Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Against Purchase Invoice (Optional)</Label>
              <Select value={payForm.purchase_id || "none"} onValueChange={(v) => {
                const pid = v === "none" ? "" : v;
                const purchase = purchases.find((p: any) => p.id === pid);
                setPayForm({ ...payForm, purchase_id: pid, amount: purchase ? String(Number(purchase.total_amount) - Number(purchase.paid_amount)) : payForm.amount });
              }}>
                <SelectTrigger><SelectValue placeholder="Select Invoice" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— General Payment —</SelectItem>
                  {unpaidPurchases.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>#{p.purchase_no} — Due: ৳{(Number(p.total_amount) - Number(p.paid_amount)).toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount *</Label>
              <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={payForm.payment_method} onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / Check No</Label>
              <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
            <Button onClick={() => savePay.mutate()} disabled={!payForm.amount || savePay.isPending} className="w-full">
              {savePay.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
              Record Payment & Generate Advice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Dialog */}
      <Dialog open={editOpen} onOpenChange={v => { if (!v) { setEditOpen(false); setEditId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Purchase</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date</Label><Input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} /></div>
              <div><Label>Paid Amount</Label><Input type="number" step="0.01" value={editForm.paid_amount} onChange={e => setEditForm({ ...editForm, paid_amount: +e.target.value })} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", description: "", quantity: 1, unit_price: 0 }])}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              <div className="space-y-2">
                {editItems.map((item: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Select value={item.product_id || "custom"} onValueChange={v => { const ni = [...editItems]; ni[i] = { ...ni[i], product_id: v === "custom" ? "" : v }; if (v !== "custom") { const prod = products.find((p: any) => p.id === v); if (prod) ni[i].unit_price = Number(prod.buy_price); } setEditItems(ni); }}>
                        <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">— Custom —</SelectItem>
                          {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Input type="number" min={1} value={item.quantity} onChange={e => { const ni = [...editItems]; ni[i] = { ...ni[i], quantity: +e.target.value }; setEditItems(ni); }} /></div>
                    <div className="col-span-3"><Input type="number" step="0.01" value={item.unit_price} onChange={e => { const ni = [...editItems]; ni[i] = { ...ni[i], unit_price: +e.target.value }; setEditItems(ni); }} /></div>
                    <div className="col-span-1 text-right text-sm font-medium py-2">৳{(item.quantity * item.unit_price).toLocaleString()}</div>
                    <div className="col-span-1">{editItems.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setEditItems(editItems.filter((_: any, idx: number) => idx !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button>}</div>
                  </div>
                ))}
              </div>
              <div className="text-right mt-2"><span className="text-lg font-bold">Total: ৳{editItems.reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0).toLocaleString()}</span></div>
            </div>

            <div><Label>Notes</Label><Textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{t.common.cancel}</Button>
              <Button type="submit" disabled={editMutation.isPending}>{editMutation.isPending ? "Saving..." : "Update Purchase"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}