import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, AlertTriangle, Search } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  buy_price: number;
  sell_price: number;
  stock: number;
  unit: string;
  status: string;
}

const emptyProduct = {
  name: "", sku: "", category: "other", description: "",
  buy_price: 0, sell_price: 0, stock: 0, unit: "pcs",
};

export default function Products() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("products").select("*").order("name");
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (data: any) => {
      if (editing) {
        const { error } = await ( supabase as any).from("products").update(data).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await ( supabase as any).from("products").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Product updated" : "Product created");
      closeDialog();
    },
    onError: () => toast.error("Failed to save product"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await ( supabase as any).from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
  });

  const closeDialog = () => { setOpen(false); setEditing(null); setForm(emptyProduct); };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku || "", category: p.category || "other", description: p.description || "", buy_price: Number(p.buy_price), sell_price: Number(p.sell_price), stock: Number(p.stock), unit: p.unit || "pcs" });
    setOpen(true);
  };

  const filtered = products.filter((p: Product) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = products.filter((p: Product) => Number(p.stock) <= 5).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Products & Inventory</h1>
            <p className="text-muted-foreground text-sm">Manage your products, stock levels, and pricing</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Product</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                  <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="router">Router</SelectItem>
                        <SelectItem value="cable">Cable</SelectItem>
                        <SelectItem value="onu">ONU</SelectItem>
                        <SelectItem value="splitter">Splitter</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Unit</Label>
                    <Select value={form.unit} onValueChange={v => setForm({...form, unit: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pcs">Pcs</SelectItem>
                        <SelectItem value="meter">Meter</SelectItem>
                        <SelectItem value="roll">Roll</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Buy Price</Label><Input type="number" step="0.01" value={form.buy_price} onChange={e => setForm({...form, buy_price: +e.target.value})} /></div>
                  <div><Label>Sell Price</Label><Input type="number" step="0.01" value={form.sell_price} onChange={e => setForm({...form, sell_price: +e.target.value})} /></div>
                </div>
                <div>
                  <Label>Stock Quantity</Label><Input type="number" value={form.stock} onChange={e => setForm({...form, stock: +e.target.value})} />
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
                  <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Package className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{products.length}</p><p className="text-sm text-muted-foreground">Total Products</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Package className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{products.reduce((s: number, p: Product) => s + Number(p.stock), 0)}</p><p className="text-sm text-muted-foreground">Total Stock</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{lowStockCount}</p><p className="text-sm text-muted-foreground">Low Stock Items</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Buy Price</TableHead>
                  <TableHead className="text-right">Sell Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
                ) : filtered.map((p: Product) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku}</TableCell>
                    <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                    <TableCell className="text-right">৳{Number(p.buy_price).toLocaleString()}</TableCell>
                    <TableCell className="text-right">৳{Number(p.sell_price).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className={Number(p.stock) <= 5 ? "text-destructive font-bold" : ""}>{p.stock} {p.unit}</span>
                    </TableCell>
                    <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) remove.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
