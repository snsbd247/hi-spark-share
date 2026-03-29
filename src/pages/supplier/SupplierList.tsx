import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search, Eye, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SupplierList() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const emptyForm = { name: "", phone: "", email: "", company: "", address: "" };
  const [form, setForm] = useState(emptyForm);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data: suppliers } = await (supabase as any).from("suppliers").select("*").order("created_at", { ascending: false });
      if (!suppliers?.length) return [];
      // Calculate due dynamically from purchases
      const { data: purchases } = await (supabase as any).from("purchases").select("supplier_id, total_amount, paid_amount");
      const dueMap: Record<string, number> = {};
      (purchases || []).forEach((p: any) => {
        const due = Number(p.total_amount || 0) - Number(p.paid_amount || 0);
        dueMap[p.supplier_id] = (dueMap[p.supplier_id] || 0) + due;
      });
      return suppliers.map((s: any) => ({ ...s, calculated_due: dueMap[s.id] || 0 }));
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editId) await ( supabase as any).from("suppliers").update(form).eq("id", editId);
      else await ( supabase as any).from("suppliers").insert(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Saved");
      closeDialog();
    },
    onError: () => toast.error("Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await ( supabase as any).from("suppliers").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };

  const filtered = rows.filter((r: any) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search) ||
    r.company?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDue = rows.reduce((s: number, r: any) => s + Number(r.calculated_due || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Suppliers</h1>
            <p className="text-muted-foreground text-sm">Manage suppliers, purchases & payments</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Supplier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Supplier</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                  <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
                  <Button type="submit" disabled={!form.name || save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Truck className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{rows.length}</p><p className="text-sm text-muted-foreground">Total Suppliers</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Truck className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">৳{totalDue.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Due</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No suppliers found</TableCell></TableRow>
                  ) : filtered.map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/supplier/${r.id}`)}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.company || "—"}</TableCell>
                      <TableCell>{r.phone || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">৳{Number(r.calculated_due || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/supplier/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ name: r.name, phone: r.phone || "", email: r.email || "", company: r.company || "", address: r.address || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Delete this supplier?")) del.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
