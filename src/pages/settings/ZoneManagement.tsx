import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Search, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ZoneManagement() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editZone, setEditZone] = useState<any>(null);
  const [deleteZone, setDeleteZone] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ area_name: "", address: "" });

  const { data: zones, isLoading } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zones").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = zones?.filter(
    (z) =>
      (z.area_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (z.address || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditZone(null);
    setForm({ area_name: "", address: "" });
    setFormOpen(true);
  };

  const openEdit = (zone: any) => {
    setEditZone(zone);
    setForm({ area_name: zone.area_name, address: zone.address || "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editZone) {
        const { error } = await supabase.from("zones").update({ area_name: form.area_name, address: form.address, updated_at: new Date().toISOString() }).eq("id", editZone.id);
        if (error) throw error;
        toast.success("Zone updated");
      } else {
        const { error } = await supabase.from("zones").insert({ area_name: form.area_name, address: form.address });
        if (error) throw error;
        toast.success("Zone created");
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["zones"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteZone) return;
    try {
      const { error } = await supabase.from("zones").delete().eq("id", deleteZone.id);
      if (error) throw error;
      toast.success("Zone deleted");
      queryClient.invalidateQueries({ queryKey: ["zones"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteZone(null);
    }
  };

  const toggleStatus = async (zone: any) => {
    const newStatus = zone.status === "active" ? "disabled" : "active";
    const { error } = await supabase.from("zones").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", zone.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Zone ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["zones"] });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zone Management</h1>
          <p className="text-muted-foreground mt-1">Manage service areas</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Zone</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search zones..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">SL#</TableHead>
                <TableHead>Area Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((zone, i) => (
                <TableRow key={zone.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{zone.area_name}</TableCell>
                  <TableCell className="text-muted-foreground">{zone.address || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={zone.status === "active" ? "default" : "secondary"}>
                      {zone.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(zone)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(zone)}>
                        {zone.status === "active" ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteZone(zone)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No zones found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editZone ? "Edit Zone" : "Add Zone"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Area Name *</Label>
              <Input value={form.area_name} onChange={(e) => setForm({ ...form, area_name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editZone ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteZone} onOpenChange={() => setDeleteZone(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteZone?.area_name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
