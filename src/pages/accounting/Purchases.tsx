import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { postPurchaseToLedger, postPurchasePaymentToLedger } from "@/lib/ledger";
import { generatePurchaseInvoicePDF } from "@/lib/accountingPdf";
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
import { Plus, Trash2, Search, FileDown, Pencil, CreditCard } from "lucide-react";
import { safeFormat } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface PurchaseItem { product_id: string; quantity: number; unit_price: number; description?: string; }

export default function Purchases() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editPurchase, setEditPurchase] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");

  const [form, setForm] = useState({
    supplier_id: "", purchase_date: new Date().toISOString().split("T")[0],
    paid_amount: 0, notes: "",
  });
  const [items, setItems] = useState<PurchaseItem[]>([{ product_id: "", quantity: 1, unit_price: 0 }]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("purchases").select("*").order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => { const { data } = await (supabase as any).from("suppliers").select("*"); return data || []; },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => { const { data } = await (supabase as any).from("products").select("*"); return data || []; },
  });

  const create = useMutation({
    mutationFn: async (formData: any) => {
      const purchaseItems: PurchaseItem[] = formData.items;
      const totalAmount = purchaseItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

      const { data: last } = await (supabase as any).from("purchases").select("purchase_no").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const lastNum = last?.purchase_no ? parseInt(last.purchase_no.replace("PUR-", "")) : 0;
      const purchaseNo = `PUR-${String(lastNum + 1).padStart(5, "0")}`;

      const { data: purchase, error } = await (supabase as any).from("purchases").insert({
        purchase_no: purchaseNo,
        supplier_id: formData.supplier_id,
        date: formData.purchase_date,
        total_amount: totalAmount,
        paid_amount: formData.paid_amount,
        notes: formData.notes,
        status: formData.paid_amount >= totalAmount ? "paid" : "unpaid",
      }).select().single();
      if (error) throw error;

      const itemsToInsert = purchaseItems.map((item) => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      await (supabase as any).from("purchase_items").insert(itemsToInsert);

      for (const item of purchaseItems) {
        const prod = products.find((p: any) => p.id === item.product_id);
        if (prod) {
          await (supabase as any).from("products").update({ stock: Number(prod.stock) + item.quantity }).eq("id", item.product_id);
        }
      }

      await postPurchaseToLedger(purchaseNo, totalAmount, formData.paid_amount, formData.purchase_date);

      const due = totalAmount - formData.paid_amount;
      if (due > 0) {
        const { data: sup } = await (supabase as any).from("suppliers").select("total_due").eq("id", formData.supplier_id).maybeSingle();
        if (sup) {
          await (supabase as any).from("suppliers").update({ total_due: Number(sup.total_due) + due }).eq("id", formData.supplier_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Purchase created & posted to ledger");
      closeDialog();
    },
    onError: () => toast.error("Failed to create purchase"),
  });

  const updatePurchase = useMutation({
    mutationFn: async (formData: any) => {
      const purchaseItems: PurchaseItem[] = formData.items;
      const totalAmount = purchaseItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

      await (supabase as any).from("purchases").update({
        supplier_id: formData.supplier_id,
        date: formData.purchase_date,
        total_amount: totalAmount,
        notes: formData.notes,
        status: Number(formData.editPurchase.paid_amount) >= totalAmount ? "paid" : "unpaid",
      }).eq("id", formData.editPurchase.id);

      // Replace items
      await (supabase as any).from("purchase_items").delete().eq("purchase_id", formData.editPurchase.id);
      const itemsToInsert = purchaseItems.map((item) => ({
        purchase_id: formData.editPurchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      await (supabase as any).from("purchase_items").insert(itemsToInsert);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Purchase updated");
      closeDialog();
    },
    onError: () => toast.error("Failed to update purchase"),
  });

  const adjustPayment = useMutation({
    mutationFn: async ({ purchase, amount, method }: { purchase: any; amount: number; method: string }) => {
      const newPaid = Number(purchase.paid_amount) + amount;
      const total = Number(purchase.total_amount);

      await (supabase as any).from("purchases").update({
        paid_amount: newPaid,
        status: newPaid >= total ? "paid" : "unpaid",
      }).eq("id", purchase.id);

      // Record supplier payment
      await (supabase as any).from("supplier_payments").insert({
        supplier_id: purchase.supplier_id,
        purchase_id: purchase.id,
        amount,
        payment_method: method,
        date: new Date().toISOString(),
        reference: `Payment against ${purchase.purchase_no}`,
      });

      // Update supplier total_due
      const { data: sup } = await (supabase as any).from("suppliers").select("total_due").eq("id", purchase.supplier_id).maybeSingle();
      if (sup) {
        await (supabase as any).from("suppliers").update({ total_due: Math.max(0, Number(sup.total_due) - amount) }).eq("id", purchase.supplier_id);
      }

      // Post accounting entry: Dr. Accounts Payable, Cr. Cash
      await postPurchasePaymentToLedger(purchase.purchase_no, amount, method, new Date().toISOString().split("T")[0]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Payment adjusted successfully");
      setPayOpen(false);
      setPayTarget(null);
      setPayAmount(0);
    },
    onError: () => toast.error("Payment adjustment failed"),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditPurchase(null);
    setForm({ supplier_id: "", purchase_date: new Date().toISOString().split("T")[0], paid_amount: 0, notes: "" });
    setItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
  };

  const openEdit = async (p: any) => {
    const { data: pItems } = await (supabase as any).from("purchase_items").select("*").eq("purchase_id", p.id);
    setEditPurchase(p);
    setForm({
      supplier_id: p.supplier_id,
      purchase_date: p.date ? new Date(p.date).toISOString().split("T")[0] : "",
      paid_amount: Number(p.paid_amount),
      notes: p.notes || "",
    });
    setItems((pItems || []).map((i: any) => ({ product_id: i.product_id, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })));
    if (items.length === 0) setItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
    setOpen(true);
  };

  const downloadPDF = async (p: any) => {
    const { data: pItems } = await (supabase as any).from("purchase_items").select("*, products(name)").eq("purchase_id", p.id);
    const supplier = suppliers.find((s: any) => s.id === p.supplier_id);
    const itemsWithNames = (pItems || []).map((i: any) => ({ ...i, product_name: i.products?.name || "Product" }));
    generatePurchaseInvoicePDF({ ...p, items: itemsWithNames }, supplier);
  };

  const addItem = () => setItems([...items, { product_id: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[i] as any)[field] = value;
    if (field === "product_id") {
      const prod = products.find((p: any) => p.id === value);
      if (prod) newItems[i].unit_price = Number(prod.buy_price);
    }
    setItems(newItems);
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id || items.some(i => !i.product_id)) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (editPurchase) {
      updatePurchase.mutate({ ...form, items, editPurchase });
    } else {
      create.mutate({ ...form, items });
    }
  };

  const getSupplierName = (id: string) => suppliers.find((s: any) => s.id === id)?.name || "—";

  const filtered = purchases.filter((p: any) =>
    p.purchase_no?.toLowerCase().includes(search.toLowerCase()) ||
    (getSupplierName(p.supplier_id) || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Purchases</h1>
            <p className="text-muted-foreground text-sm">Purchase products from suppliers and track inventory</p>
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Purchase</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editPurchase ? "Edit Purchase" : "Create Purchase"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Supplier *</Label>
                    <Select value={form.supplier_id} onValueChange={v => setForm({...form, supplier_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{suppliers.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} /></div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-semibold">Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add Item</Button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <Select value={item.product_id} onValueChange={v => updateItem(i, "product_id", v)}>
                            <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku || "N/A"})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2"><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(i, "quantity", +e.target.value)} placeholder="Qty" /></div>
                        <div className="col-span-3"><Input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(i, "unit_price", +e.target.value)} placeholder="Price" /></div>
                        <div className="col-span-1 text-right font-medium text-sm py-2">৳{(item.quantity * item.unit_price).toLocaleString()}</div>
                        <div className="col-span-1">{items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {!editPurchase && (
                    <div><Label>Paid Amount</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm({...form, paid_amount: +e.target.value})} /></div>
                  )}
                  <div className="flex items-end"><div className="text-right w-full"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold text-foreground">৳{subtotal.toLocaleString()}</p></div></div>
                </div>

                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
                  <Button type="submit" disabled={create.isPending || updatePurchase.isPending}>
                    {editPurchase ? "Update Purchase" : "Create Purchase"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Payment Adjustment Dialog */}
        <Dialog open={payOpen} onOpenChange={v => { if (!v) { setPayOpen(false); setPayTarget(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Payment Adjustment</DialogTitle></DialogHeader>
            {payTarget && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="font-medium">Invoice:</span> {payTarget.purchase_no}</p>
                  <p><span className="font-medium">Total:</span> ৳{Number(payTarget.total_amount).toLocaleString()}</p>
                  <p><span className="font-medium">Paid:</span> ৳{Number(payTarget.paid_amount).toLocaleString()}</p>
                  <p className="text-destructive font-semibold">Due: ৳{(Number(payTarget.total_amount) - Number(payTarget.paid_amount)).toLocaleString()}</p>
                </div>
                <div><Label>Payment Amount</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(+e.target.value)} max={Number(payTarget.total_amount) - Number(payTarget.paid_amount)} /></div>
                <div><Label>Payment Method</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="bkash">bKash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setPayOpen(false); setPayTarget(null); }}>{t.common.cancel}</Button>
                  <Button disabled={payAmount <= 0 || adjustPayment.isPending} onClick={() => adjustPayment.mutate({ purchase: payTarget, amount: payAmount, method: payMethod })}>
                    {adjustPayment.isPending ? "Processing..." : "Confirm Payment"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search purchases..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No purchases found</TableCell></TableRow>
                ) : filtered.map((p: any) => {
                  const due = Number(p.total_amount) - Number(p.paid_amount);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.purchase_no}</TableCell>
                      <TableCell>{getSupplierName(p.supplier_id)}</TableCell>
                      <TableCell>{safeFormat(p.date, "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">৳{Number(p.total_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right">৳{Number(p.paid_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive">৳{due.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => downloadPDF(p)} title="Download PDF"><FileDown className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                          {due > 0 && (
                            <Button variant="ghost" size="icon" onClick={() => { setPayTarget(p); setPayAmount(due); setPayOpen(true); }} title="Adjust Payment">
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
