import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiDb } from "@/lib/apiDb";
import { postPurchaseToLedger } from "@/lib/ledger";
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
import { Plus, Trash2, Search } from "lucide-react";
import { safeFormat } from "@/lib/utils";

interface PurchaseItem { product_id: string; quantity: number; unit_price: number; }

export default function Purchases() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    supplier_id: "", purchase_date: new Date().toISOString().split("T")[0],
    paid_amount: 0, notes: "",
  });
  const [items, setItems] = useState<PurchaseItem[]>([{ product_id: "", quantity: 1, unit_price: 0 }]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data } = await apiDb.from("purchases").select("*").order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => { const { data } = await apiDb.from("suppliers").select("*"); return data || []; },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => { const { data } = await apiDb.from("products").select("*"); return data || []; },
  });

  const create = useMutation({
    mutationFn: async (formData: any) => {
      const purchaseItems: PurchaseItem[] = formData.items;
      const totalAmount = purchaseItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

      // Generate purchase number
      const { data: last } = await apiDb.from("purchases").select("purchase_no").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const lastNum = last?.purchase_no ? parseInt(last.purchase_no.replace("PUR-", "")) : 0;
      const purchaseNo = `PUR-${String(lastNum + 1).padStart(5, "0")}`;

      const { data: purchase, error } = await apiDb.from("purchases").insert({
        purchase_no: purchaseNo,
        supplier_id: formData.supplier_id,
        date: formData.purchase_date,
        total_amount: totalAmount,
        paid_amount: formData.paid_amount,
        notes: formData.notes,
        status: formData.paid_amount >= totalAmount ? "paid" : "unpaid",
      }).select().single();
      if (error) throw error;

      // Insert purchase items
      const itemsToInsert = purchaseItems.map((item) => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
      await apiDb.from("purchase_items").insert(itemsToInsert);

      // Increase product stock
      for (const item of purchaseItems) {
        const prod = products.find((p: any) => p.id === item.product_id);
        if (prod) {
          await apiDb.from("products").update({ stock: Number(prod.stock) + item.quantity }).eq("id", item.product_id);
        }
      }

      // Post to accounting ledger
      await postPurchaseToLedger(purchaseNo, totalAmount, formData.paid_amount, formData.purchase_date);

      // Update supplier total_due
      const due = totalAmount - formData.paid_amount;
      if (due > 0) {
        const { data: sup } = await apiDb.from("suppliers").select("total_due").eq("id", formData.supplier_id).maybeSingle();
        if (sup) {
          await apiDb.from("suppliers").update({ total_due: Number(sup.total_due) + due }).eq("id", formData.supplier_id);
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

  const closeDialog = () => {
    setOpen(false);
    setForm({ supplier_id: "", purchase_date: new Date().toISOString().split("T")[0], paid_amount: 0, notes: "" });
    setItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
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
    create.mutate({ ...form, items });
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
              <DialogHeader><DialogTitle>Create Purchase</DialogTitle></DialogHeader>
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
                  <div><Label>Paid Amount</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm({...form, paid_amount: +e.target.value})} /></div>
                  <div className="flex items-end"><div className="text-right w-full"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold text-foreground">৳{subtotal.toLocaleString()}</p></div></div>
                </div>

                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>

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
                    <TableCell className="font-medium">{p.purchase_no}</TableCell>
                    <TableCell>{getSupplierName(p.supplier_id)}</TableCell>
                    <TableCell>{safeFormat(p.date, "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right">৳{Number(p.total_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">৳{Number(p.paid_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">৳{(Number(p.total_amount) - Number(p.paid_amount)).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
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
