import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { apiDb } from "@/lib/apiDb";
import { format } from "date-fns";

interface PurchaseItem { product_id: string; description: string; quantity: number; unit_price: number; }

export default function Purchases() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    supplier_id: "", date: new Date().toISOString().split("T")[0],
    paid_amount: 0, notes: "",
  });
  const [items, setItems] = useState<PurchaseItem[]>([{ product_id: "", description: "", quantity: 1, unit_price: 0 }]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data } = await apiDb.from("purchases").select("*").order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await apiDb.from("suppliers").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await apiDb.from("products").select("id, name, sku, buy_price").order("name");
      return data || [];
    },
  });

  const supplierMap = Object.fromEntries(suppliers.map((s: any) => [s.id, s.name]));

  const create = useMutation({
    mutationFn: async () => {
      const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const purchaseNo = `PO-${Date.now().toString().slice(-8)}`;
      const status = form.paid_amount >= total ? "paid" : form.paid_amount > 0 ? "partial" : "unpaid";

      const { data: purchase, error } = await apiDb.from("purchases").insert({
        supplier_id: form.supplier_id,
        purchase_no: purchaseNo,
        date: form.date,
        total_amount: total,
        paid_amount: form.paid_amount,
        status,
        notes: form.notes || null,
      }).select("id").single();

      if (error) throw error;

      // Insert purchase items
      const purchaseItems = items.filter(i => i.product_id || i.description).map(i => ({
        purchase_id: purchase.id,
        product_id: i.product_id || null,
        description: i.description || null,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }));

      if (purchaseItems.length > 0) {
        await apiDb.from("purchase_items").insert(purchaseItems);
      }

      // Update product stock
      for (const item of items) {
        if (item.product_id) {
          const prod = products.find((p: any) => p.id === item.product_id);
          if (prod) {
            await apiDb.from("products").update({ stock: Number(prod.stock || 0) + item.quantity }).eq("id", item.product_id);
          }
        }
      }

      // Update supplier total_due
      const due = total - form.paid_amount;
      if (due > 0) {
        const supplier = await apiDb.from("suppliers").select("total_due").eq("id", form.supplier_id).single();
        if (supplier.data) {
          await apiDb.from("suppliers").update({ total_due: Number(supplier.data.total_due || 0) + due }).eq("id", form.supplier_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Purchase created");
      closeDialog();
    },
    onError: () => toast.error("Failed to create purchase"),
  });

  const closeDialog = () => {
    setOpen(false);
    setForm({ supplier_id: "", date: new Date().toISOString().split("T")[0], paid_amount: 0, notes: "" });
    setItems([{ product_id: "", description: "", quantity: 1, unit_price: 0 }]);
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
    supplierMap[p.supplier_id]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Purchases</h1>
            <p className="text-muted-foreground text-sm">Purchase from suppliers and track inventory</p>
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Purchase</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Purchase</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (!form.supplier_id) { toast.error("Select a supplier"); return; } create.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Supplier *</Label>
                    <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
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
                          <Select value={item.product_id || "custom"} onValueChange={v => updateItem(i, "product_id", v === "custom" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">— Custom Item —</SelectItem>
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
                  <div><Label>Paid Amount</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: +e.target.value })} /></div>
                  <div className="flex items-end"><div className="text-right w-full"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold text-foreground">৳{subtotal.toLocaleString()}</p></div></div>
                </div>

                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                  <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating..." : "Create Purchase"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchases found</TableCell></TableRow>
                ) : filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium font-mono">{p.purchase_no}</TableCell>
                    <TableCell>{supplierMap[p.supplier_id] || "—"}</TableCell>
                    <TableCell>{format(new Date(p.date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right">৳{Number(p.total_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">৳{Number(p.paid_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">৳{(Number(p.total_amount) - Number(p.paid_amount)).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "paid" ? "default" : p.status === "partial" ? "secondary" : "destructive"}>{p.status}</Badge>
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
