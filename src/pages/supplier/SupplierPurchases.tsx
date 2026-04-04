import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
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
import { Plus, Trash2, Search, Printer, Pencil, Wallet } from "lucide-react";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { generateSupplierPurchaseInvoicePDF } from "@/lib/supplierPurchasePdf";
import { useLanguage } from "@/contexts/LanguageContext";

interface PurchaseItem { product_id: string; description: string; quantity: number; unit_price: number; }

export default function SupplierPurchases() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  // Payment adjustment state
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");

  const [form, setForm] = useState({
    supplier_id: "", date: new Date().toISOString().split("T")[0],
    paid_amount: 0, notes: "",
  });
  const [items, setItems] = useState<PurchaseItem[]>([{ product_id: "", description: "", quantity: 1, unit_price: 0 }]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["supplier-purchases", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant((db as any).from("purchases").select("*").order("date", { ascending: false }), tenantId);
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant((db as any).from("suppliers").select("id, name, company, phone").order("name"), tenantId);
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant((db as any).from("products").select("id, name, sku, buy_price").order("name"), tenantId);
      return data || [];
    },
  });

  const supplierMap = Object.fromEntries(suppliers.map((s: any) => [s.id, s]));

  // ── Create / Edit mutation ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const status = form.paid_amount >= total ? "paid" : form.paid_amount > 0 ? "partial" : "unpaid";

      if (editId) {
        // Update purchase
        await (db as any).from("purchases").update({
          supplier_id: form.supplier_id,
          date: form.date,
          total_amount: total,
          paid_amount: form.paid_amount,
          status,
          notes: form.notes || null,
        }).eq("id", editId);

        // Replace items
        await (db as any).from("purchase_items").delete().eq("purchase_id", editId);
        const purchaseItems = items.filter(i => i.product_id || i.description).map(i => ({
          purchase_id: editId,
          product_id: i.product_id || null,
          description: i.description || null,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }));
        if (purchaseItems.length > 0) {
          await (db as any).from("purchase_items").insert(purchaseItems);
        }
      } else {
        // Create
        const purchaseNo = `PO-${Date.now().toString().slice(-8)}`;
        const { data: purchase, error } = await (db as any).from("purchases").insert({
          supplier_id: form.supplier_id,
          purchase_no: purchaseNo,
          date: form.date,
          total_amount: total,
          paid_amount: form.paid_amount,
          status,
          notes: form.notes || null,
        }).select("id").single();
        if (error) throw error;

        const purchaseItems = items.filter(i => i.product_id || i.description).map(i => ({
          purchase_id: purchase.id,
          product_id: i.product_id || null,
          description: i.description || null,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }));
        if (purchaseItems.length > 0) {
          await (db as any).from("purchase_items").insert(purchaseItems);
        }

        // Update product stock
        for (const item of items) {
          if (item.product_id) {
            const prod = products.find((p: any) => p.id === item.product_id);
            if (prod) {
              await (db as any).from("products").update({ stock: Number(prod.stock || 0) + item.quantity }).eq("id", item.product_id);
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editId ? "Purchase updated" : "Purchase created");
      closeDialog();
    },
    onError: () => toast.error("Failed"),
  });

  // ── Payment Adjustment mutation ──
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payTarget) return;
      const amount = Number(payAmount);
      if (amount <= 0) throw new Error("Invalid amount");

      const newPaid = Number(payTarget.paid_amount) + amount;
      const total = Number(payTarget.total_amount);
      const newStatus = newPaid >= total ? "paid" : "partial";

      await (db as any).from("purchases").update({
        paid_amount: newPaid,
        status: newStatus,
      }).eq("id", payTarget.id);

      // Record supplier payment
      await (db as any).from("supplier_payments").insert({
        supplier_id: payTarget.supplier_id,
        purchase_id: payTarget.id,
        amount,
        payment_method: payMethod,
        paid_date: new Date().toISOString(),
        notes: payNote || `Payment against ${payTarget.purchase_no}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-purchases"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayTarget(null);
      setPayAmount("");
      setPayNote("");
    },
    onError: (e: any) => toast.error(e.message || "Payment failed"),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditId(null);
    setForm({ supplier_id: "", date: new Date().toISOString().split("T")[0], paid_amount: 0, notes: "" });
    setItems([{ product_id: "", description: "", quantity: 1, unit_price: 0 }]);
  };

  const openEdit = async (p: any) => {
    setEditId(p.id);
    setForm({ supplier_id: p.supplier_id, date: p.date?.split("T")[0] || "", paid_amount: Number(p.paid_amount), notes: p.notes || "" });
    // Load items
    const { data: pItems } = await (db as any).from("purchase_items").select("*").eq("purchase_id", p.id);
    if (pItems?.length) {
      setItems(pItems.map((i: any) => ({ product_id: i.product_id || "", description: i.description || "", quantity: Number(i.quantity), unit_price: Number(i.unit_price) })));
    } else {
      setItems([{ product_id: "", description: "", quantity: 1, unit_price: 0 }]);
    }
    setOpen(true);
  };

  const openPayment = (p: any) => {
    setPayTarget(p);
    setPayAmount("");
    setPayNote("");
    setPayMethod("cash");
    setPayOpen(true);
  };

  const handlePrint = async (p: any) => {
    const { data: pItems } = await (db as any).from("purchase_items").select("*, products(name, sku)").eq("purchase_id", p.id);
    const supplier = supplierMap[p.supplier_id];
    generateSupplierPurchaseInvoicePDF(p, supplier, pItems || []);
  };

  const addItem = () => setItems([...items, { product_id: "", description: "", quantity: 1, unit_price: 0 }]);
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

  const filtered = purchases.filter((p: any) =>
    p.purchase_no?.toLowerCase().includes(search.toLowerCase()) ||
    supplierMap[p.supplier_id]?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t.purchases.title}</h1>
            <p className="text-muted-foreground text-sm">{t.purchases.subtitle}</p>
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{t.purchases.newPurchase}</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? t.purchases.editPurchase : t.purchases.createPurchase}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (!form.supplier_id) { toast.error("Select a supplier"); return; } saveMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t.purchases.supplier} *</Label>
                    <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                      <SelectTrigger><SelectValue placeholder={t.purchases.selectSupplier} /></SelectTrigger>
                      <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>{t.common.date}</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-semibold">{t.purchases.items}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />{t.purchases.addItem}</Button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <Select value={item.product_id || "custom"} onValueChange={v => updateItem(i, "product_id", v === "custom" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">{t.purchases.customItem}</SelectItem>
                              {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</SelectItem>)}
                            </SelectContent>
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
                  <div><Label>{t.purchases.paidAmount}</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: +e.target.value })} /></div>
                  <div className="flex items-end"><div className="text-right w-full"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold text-foreground">৳{subtotal.toLocaleString()}</p></div></div>
                </div>

                <div><Label>{t.purchases.notes}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : editId ? "Update Purchase" : "Create Purchase"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder={t.purchases.searchPurchases} value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.purchases.purchaseNo}</TableHead>
                  <TableHead>{t.purchases.supplier}</TableHead>
                  <TableHead>{t.common.date}</TableHead>
                  <TableHead className="text-right">{t.common.total}</TableHead>
                  <TableHead className="text-right">{t.common.paid}</TableHead>
                  <TableHead className="text-right">{t.purchases.due}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t.purchases.noPurchasesFound}</TableCell></TableRow>
                ) : filtered.map((p: any) => {
                  const due = Number(p.total_amount) - Number(p.paid_amount);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium font-mono">{p.purchase_no}</TableCell>
                      <TableCell>{supplierMap[p.supplier_id]?.name || "—"}</TableCell>
                      <TableCell>{safeFormat(p.date, "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">৳{Number(p.total_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right">৳{Number(p.paid_amount).toLocaleString()}</TableCell>
                      <TableCell className={`text-right ${due > 0 ? "text-destructive font-semibold" : "text-success"}`}>
                        ৳{due.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "paid" ? "default" : p.status === "partial" ? "secondary" : "destructive"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Print Invoice" onClick={() => handlePrint(p)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {p.status !== "paid" && (
                            <Button size="icon" variant="ghost" title="Payment Adjustment" className="text-success" onClick={() => openPayment(p)}>
                              <Wallet className="h-4 w-4" />
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

      {/* Payment Adjustment Dialog */}
      <Dialog open={payOpen} onOpenChange={v => { if (!v) { setPayOpen(false); setPayTarget(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.purchases.paymentAdjustment}</DialogTitle></DialogHeader>
          {payTarget && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono font-medium">{payTarget.purchase_no}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium">৳{Number(payTarget.total_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="font-medium text-success">৳{Number(payTarget.paid_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground font-semibold">Due</span>
                  <span className="font-bold text-destructive">৳{(Number(payTarget.total_amount) - Number(payTarget.paid_amount)).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div><Label>{t.purchases.paymentAmount} *</Label>
                  <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    placeholder={`Max: ৳${(Number(payTarget.total_amount) - Number(payTarget.paid_amount)).toLocaleString()}`} />
                </div>
                <div><Label>{t.purchases.paymentMethod}</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="bkash">bKash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t.common.note}</Label><Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Optional note" /></div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPayOpen(false)}>{t.common.cancel}</Button>
                <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !payAmount}>
                  {payMutation.isPending ? "Processing..." : t.purchases.recordPayment}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
