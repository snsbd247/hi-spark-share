import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Loader2, Search, Server } from "lucide-react";
import { toast } from "sonner";

export default function OLTManagement() {
  const [formOpen, setFormOpen] = useState(false);
  const [editOlt, setEditOlt] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", ip_address: "", location: "", brand: "" });
  const queryClient = useQueryClient();

  const { data: olts, isLoading } = useQuery({
    queryKey: ["olts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("olts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = olts?.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.ip_address.includes(search) ||
      (o.location || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditOlt(null);
    setForm({ name: "", ip_address: "", location: "", brand: "" });
    setFormOpen(true);
  };

  const openEdit = (olt: any) => {
    setEditOlt(olt);
    setForm({ name: olt.name, ip_address: olt.ip_address, location: olt.location || "", brand: olt.brand || "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { name: form.name, ip_address: form.ip_address, location: form.location || null, brand: form.brand || null };
    try {
      if (editOlt) {
        const { error } = await supabase.from("olts").update(payload).eq("id", editOlt.id);
        if (error) throw error;
        toast.success("OLT updated");
      } else {
        const { error } = await supabase.from("olts").insert(payload);
        if (error) throw error;
        toast.success("OLT added");
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["olts"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">OLT Management</h1>
          <p className="text-muted-foreground mt-1">Manage your Optical Line Terminals</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add OLT
        </Button>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search OLTs..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No OLTs found</TableCell></TableRow>
                ) : (
                  filtered?.map((olt) => (
                    <TableRow key={olt.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{olt.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{olt.ip_address}</TableCell>
                      <TableCell>{olt.location || "—"}</TableCell>
                      <TableCell>{olt.brand || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={olt.is_active ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                          {olt.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(olt)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editOlt ? "Edit OLT" : "Add OLT"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>OLT Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>IP Address *</Label>
              <Input placeholder="192.168.1.1" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Input placeholder="e.g. Huawei, ZTE, BDCOM" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editOlt ? "Update" : "Add OLT"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
