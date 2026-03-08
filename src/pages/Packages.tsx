import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Loader2, Wifi, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export default function Packages() {
  const [formOpen, setFormOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", speed: "", monthly_price: "", bandwidth_profile: "",
    download_speed: "", upload_speed: "", burst_limit: "",
  });
  const queryClient = useQueryClient();

  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

      // Auto-sync to MikroTik if bandwidth is set
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
    } catch (err: any) {
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
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" /> Add Package
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages?.map((pkg) => (
            <Card key={pkg.id} className="glass-card animate-fade-in group">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wifi className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{pkg.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{pkg.speed}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition"
                    onClick={() => syncToMikrotik(pkg.id)}
                    disabled={syncing === pkg.id}
                    title="Sync to MikroTik"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing === pkg.id ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition"
                    onClick={() => openEdit(pkg)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  ৳{Number(pkg.monthly_price).toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(pkg.download_speed > 0 || pkg.upload_speed > 0) && (
                    <Badge variant="outline" className="bg-primary/5">
                      ↓{pkg.download_speed}M / ↑{pkg.upload_speed}M
                    </Badge>
                  )}
                  {pkg.mikrotik_profile_name && (
                    <Badge variant="outline" className="bg-success/5 text-success border-success/20">
                      MikroTik: {pkg.mikrotik_profile_name}
                    </Badge>
                  )}
                  {pkg.bandwidth_profile && (
                    <Badge variant="outline">{pkg.bandwidth_profile}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {packages?.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-12">No packages yet. Add your first package.</p>
          )}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editPkg ? "Edit Package" : "Add Package"}</DialogTitle>
          </DialogHeader>
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
    </DashboardLayout>
  );
}
