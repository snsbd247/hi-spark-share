import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Vendor {
  id: string; name: string; phone: string; email: string; company: string;
  address: string; balance: number; status: string; notes: string;
}

const emptyVendor = { name: "", phone: "", email: "", company: "", address: "", status: "active", notes: "" };

export default function Vendors() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyVendor);
  const [search, setSearch] = useState("");

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => { const { data } = await (supabase as any).from("vendors").select("*").order("created_at", { ascending: false }); return (data || []) as Vendor[]; },
  });

  const save = useMutation({
    mutationFn: async (formData: any) => {
      if (editing) {
        const { error } = await (supabase as any).from("vendors").update(formData).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("vendors").insert(formData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(editing ? "Vendor updated" : "Vendor created");
      closeDialog();
    },
    onError: () => toast.error("Failed to save vendor"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("vendors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors"] }); toast.success("Vendor deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditing(null); setForm(emptyVendor); };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({ name: v.name, phone: v.phone || "", email: v.email || "", company: v.company || "", address: v.address || "", status: v.status, notes: v.notes || "" });
    setOpen(true);
  };

  const filtered = vendors.filter((v: Vendor) =>
    v.name?.toLowerCase().includes(search.toLowerCase()) || v.phone?.includes(search)
  );

  const totalDue = vendors.reduce((s: number, v: Vendor) => s + Number(v.balance || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
            <p className="text-muted-foreground text-sm">Manage your suppliers and vendor accounts</p>
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Vendor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                  <div><Label>Company</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} /></div>
                </div>
                <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>{t.common.cancel}</Button>
                  <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Building2 className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{vendors.length}</p><p className="text-sm text-muted-foreground">Total Vendors</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Building2 className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">৳{totalDue.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Due</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No vendors found</TableCell></TableRow>
                ) : filtered.map((v: Vendor) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.phone}</TableCell>
                    <TableCell>{v.company}</TableCell>
                    <TableCell className="text-right font-medium">৳{Number(v.balance || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={v.status === "active" ? "default" : "secondary"}>{v.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) remove.mutate(v.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
