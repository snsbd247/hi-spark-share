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
import { Plus, Pencil, Trash2, Loader2, Search, Ban, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export default function Packages() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<any>(null);
  const [deletePkg, setDeletePkg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", speed: "", monthly_price: "", bandwidth_profile: "",
    download_speed: "", upload_speed: "", burst_limit: "",
  });

  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = packages?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.speed.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditPkg(null);
    setForm({ name: "", speed: "", monthly_price: "", bandwidth_profile: "", download_speed: "", upload_speed: "", burst_limit: "" });
    setFormOpen(true);
  };

  const openEdit = (pkg: any) => {
    setEditPkg(pkg);
    setForm({
      name: pkg.name,
      speed: pkg.speed,
      monthly_price: pkg.monthly_price.toString(),
      bandwidth_profile: pkg.bandwidth_profile || "",
      download_speed: pkg.download_speed?.toString() || "",
      upload_speed: pkg.upload_speed?.toString() || "",
      burst_limit: pkg.burst_limit || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      name: form.name,
      speed: form.speed,
      monthly_price: parseFloat(form.monthly_price) || 0,
      bandwidth_profile: form.bandwidth_profile || null,
      download_speed: parseInt(form.download_speed) || 0,
      upload_speed: parseInt(form.upload_speed) || 0,
      burst_limit: form.burst_limit || null,
    };

    try {
      let packageId: string;
      if (editPkg) {
        const { error } = await supabase.from("packages").update(payload).eq("id", editPkg.id);
        if (error) throw error;
        packageId = editPkg.id;
        toast.success("Package updated");
      } else {
        const { data, error } = await supabase.from("packages").insert(payload).select().single();
        if (error) throw error;
        packageId = data.id;
        toast.success("Package created");
      }

      if (payload.download_speed > 0 || payload.upload_speed > 0) {
        syncToMikrotik(packageId);
      }

      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["packages-all"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePkg) return;
    try {
      const { error } = await supabase.from("packages").delete().eq("id", deletePkg.id);
      if (error) throw error;
      toast.success("Package deleted");
      queryClient.invalidateQueries({ queryKey: ["packages-all"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletePkg(null);
    }
  };

  const toggleStatus = async (pkg: any) => {
    const newStatus = !pkg.is_active;
    const { error } = await supabase.from("packages").update({ is_active: newStatus }).eq("id", pkg.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Package ${newStatus ? "enabled" : "disabled"}`);
      queryClient.invalidateQueries({ queryKey: ["packages-all"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
    }
  };

  const syncToMikrotik = async (packageId: string) => {
    setSyncing(packageId);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mikrotik-sync/sync-profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: packageId }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(`MikroTik profile synced: ${data.profile_name}`);
      } else {
        toast.error(data.error || "MikroTik sync failed");
      }
    } catch {
      toast.error("Could not connect to MikroTik");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Packages</h1>
          <p className="text-muted-foreground mt-1">Manage internet packages & bandwidth</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Package</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search packages..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                <TableHead>Package Name</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Bandwidth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((pkg, i) => (
                <TableRow key={pkg.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>{pkg.speed}</TableCell>
                  <TableCell>৳{Number(pkg.monthly_price).toLocaleString()}/mo</TableCell>
                  <TableCell>
                    {(pkg.download_speed > 0 || pkg.upload_speed > 0) ? (
                      <span className="text-sm">↓{pkg.download_speed}M / ↑{pkg.upload_speed}M</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => syncToMikrotik(pkg.id)} disabled={syncing === pkg.id} title="Sync to MikroTik">
                        <RefreshCw className={`h-4 w-4 ${syncing === pkg.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(pkg)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(pkg)}>
                        {pkg.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletePkg(pkg)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No packages found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editPkg ? "Edit Package" : "Add Package"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Package Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Speed Label *</Label>
                <Input placeholder="e.g. 10 Mbps" value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Price *</Label>
              <Input type="number" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} required />
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bandwidth Control (MikroTik)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Download Speed (Mbps)</Label>
                  <Input type="number" placeholder="e.g. 10" value={form.download_speed} onChange={(e) => setForm({ ...form, download_speed: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Upload Speed (Mbps)</Label>
                  <Input type="number" placeholder="e.g. 10" value={form.upload_speed} onChange={(e) => setForm({ ...form, upload_speed: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                <Label>Burst Limit</Label>
                <Input placeholder="e.g. 15M/15M" value={form.burst_limit} onChange={(e) => setForm({ ...form, burst_limit: e.target.value })} />
              </div>
              <div className="space-y-1.5 mt-4">
                <Label>Bandwidth Profile</Label>
                <Input value={form.bandwidth_profile} onChange={(e) => setForm({ ...form, bandwidth_profile: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editPkg ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePkg} onOpenChange={() => setDeletePkg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deletePkg?.name}"? This may affect customers using this package.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
