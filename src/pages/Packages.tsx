import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, supabaseDirect } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Search, Ban, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import { IS_LOVABLE } from "@/lib/environment";
import { useLanguage } from "@/contexts/LanguageContext";

// Helper: call Laravel MikroTik API (production only)
async function mikrotikCall(path: string, body: any) {
  const { data } = await api.post(`/mikrotik/${path}`, body);
  return data;
}

// Helper: call edge function for Lovable preview
async function mikrotikEdge(action: string, body: any) {
  const { data, error } = await supabaseDirect.functions.invoke(`mikrotik-sync/${action}`, { body });
  if (error) throw error;
  return data;
}

export default function Packages() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const [formOpen, setFormOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<any>(null);
  const [deletePkg, setDeletePkg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", speed: "", monthly_price: "", bandwidth_profile: "",
    download_speed: "", upload_speed: "", burst_limit: "", router_id: "", ip_pool_id: "",
  });

  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages-all", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeByTenant(db.from("packages").select("*, mikrotik_routers(name), ip_pools(name, gateway)").order("created_at", { ascending: false }), tenantId);
      if (error) throw error;
      return data;
    },
  });

  const { data: routers } = useQuery({
    queryKey: ["mikrotik-routers-active", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeByTenant(db.from("mikrotik_routers").select("*").eq("status", "active"), tenantId);
      if (error) throw error;
      return data;
    },
  });

  const { data: ipPools } = useQuery({
    queryKey: ["ip-pools-active", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeByTenant(db.from("ip_pools").select("*").eq("status", "active"), tenantId);
      if (error) throw error;
      return data;
    },
  });

  const filtered = packages?.filter(
    (p) =>
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.speed || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditPkg(null);
    setForm({ name: "", speed: "", monthly_price: "", bandwidth_profile: "", download_speed: "", upload_speed: "", burst_limit: "", router_id: "", ip_pool_id: "" });
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
      router_id: pkg.router_id || "",
      ip_pool_id: pkg.ip_pool_id || "",
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
      router_id: form.router_id || null,
      ip_pool_id: form.ip_pool_id || null,
    };

    try {
      let packageId: string;
      if (editPkg) {
        const { error } = await db.from("packages").update(payload).eq("id", editPkg.id);
        if (error) throw error;
        packageId = editPkg.id;
        toast.success("Package updated");
      } else {
        const { data, error } = await db.from("packages").insert(payload).select().single();
        if (error) throw error;
        packageId = data.id;
        toast.success("Package created");
      }

      // Auto-sync PPP profile to MikroTik
      if (payload.download_speed > 0 || payload.upload_speed > 0) {
        syncToMikrotik(packageId, form.router_id);
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
      // Remove profile from MikroTik first
      if (deletePkg.mikrotik_profile_name) {
        try {
          await mikrotikCall('remove-profile', {
            package_id: deletePkg.id,
            router_id: deletePkg.router_id,
          });
        } catch { /* best effort */ }
      }
      const { error } = await db.from("packages").delete().eq("id", deletePkg.id);
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
    const { error } = await db.from("packages").update({ is_active: newStatus }).eq("id", pkg.id);
    if (error) { toast.error(error.message); return; }

    // If disabling, remove profile from MikroTik
    if (!newStatus && pkg.mikrotik_profile_name) {
      try {
        await mikrotikCall('remove-profile', {
          package_id: pkg.id,
          router_id: pkg.router_id,
        });
        toast.info("MikroTik profile removed");
      } catch { /* best effort */ }
    }

    toast.success(`Package ${newStatus ? "enabled" : "disabled"}`);
    queryClient.invalidateQueries({ queryKey: ["packages-all"] });
    queryClient.invalidateQueries({ queryKey: ["packages"] });
  };

  const syncToMikrotik = async (packageId: string, routerId?: string) => {
    setSyncing(packageId);
    try {
      if (IS_LOVABLE) {
        // Find router credentials for edge function
        const router = routers?.find((r: any) => r.id === routerId);
        if (!router) { toast.error("রাউটার সিলেক্ট করুন"); return; }
        // Find pool info for PPP profile
        const pkg = packages?.find((p: any) => p.id === packageId);
        const pool = ipPools?.find((p: any) => p.id === pkg?.ip_pool_id);
        const data = await mikrotikEdge('sync-profile', {
          package_id: packageId, router_id: routerId,
          ip_address: router.ip_address, username: router.username, password: router.password, api_port: router.api_port,
          remote_address: pool?.name || undefined,
          local_address: pool?.gateway || undefined,
        });
        if (data?.success) {
          toast.success(`MikroTik profile synced: ${data.profile_name}`);
          queryClient.invalidateQueries({ queryKey: ["packages-all"] });
        } else toast.error(data?.error || "MikroTik sync failed");
      } else {
        const pkg = packages?.find((p: any) => p.id === packageId);
        const pool = ipPools?.find((p: any) => p.id === pkg?.ip_pool_id);
        const data = await mikrotikCall('sync-profile', {
          package_id: packageId, router_id: routerId || undefined,
          remote_address: pool?.name || undefined,
          local_address: pool?.gateway || undefined,
        });
        if (data.success) {
          toast.success(`MikroTik profile synced: ${data.profile_name}`);
          queryClient.invalidateQueries({ queryKey: ["packages-all"] });
        } else toast.error(data.error || "MikroTik sync failed");
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (IS_LOVABLE && (msg.includes("Connection refused") || msg.includes("timeout"))) {
        toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট পাবলিকলি ওপেন করুন।", { duration: 8000 });
      } else {
        toast.error("Could not connect to MikroTik");
      }
    } finally { setSyncing(null); }
  };

  const bulkSyncPackages = async () => {
    setBulkSyncing(true);
    try {
      if (IS_LOVABLE) {
        // Get first active router for credentials
        const router = routers?.[0];
        if (!router) { toast.error("কোনো রাউটার কনফিগার করা নেই"); setBulkSyncing(false); return; }
        const data = await mikrotikEdge('bulk-sync-packages', {
          router_id: router.id, ip_address: router.ip_address, username: router.username, password: router.password, api_port: router.api_port,
        });
        if (data?.success) {
          const r = data.results || {};
          if (r.errors?.length && !r.synced && !r.imported) {
            const errMsg = r.errors[0] || "";
            if (errMsg.includes("Connection refused") || errMsg.includes("timeout")) {
              toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট Supabase সার্ভার থেকে অ্যাক্সেসযোগ্য হতে হবে।", { duration: 8000 });
            } else toast.error(`Sync failed: ${errMsg}`);
          } else {
            const parts = [];
            if (r.synced > 0) parts.push(`${r.synced} pushed`);
            if (r.imported > 0) parts.push(`${r.imported} imported`);
            if (r.failed > 0) parts.push(`${r.failed} failed`);
            toast.success(`Sync complete: ${parts.join(", ") || "No changes"}`);
            queryClient.invalidateQueries({ queryKey: ["packages-all"] });
          }
        } else toast.error(data?.error || "Bulk sync failed");
      } else {
        const data = await mikrotikCall('bulk-sync-packages', {});
        if (data.success) {
          const r = data.results;
          const parts = [];
          if (r.synced > 0) parts.push(`${r.synced} pushed`);
          if (r.imported > 0) parts.push(`${r.imported} imported`);
          if (r.failed > 0) parts.push(`${r.failed} failed`);
          toast.success(`Sync complete: ${parts.join(", ") || "No changes"}`);
          if (r.errors?.length > 0) toast.warning(`Errors: ${r.errors.slice(0, 3).join("; ")}`);
          queryClient.invalidateQueries({ queryKey: ["packages-all"] });
        } else toast.error(data.error || "Bulk sync failed");
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (IS_LOVABLE && (msg.includes("Connection refused") || msg.includes("timeout"))) {
        toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট পাবলিকলি ওপেন করুন।", { duration: 8000 });
      } else {
        toast.error("Could not connect to MikroTik");
      }
    } finally { setBulkSyncing(false); }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
           <h1 className="text-2xl font-bold text-foreground">{t.sidebar.packages}</h1>
            <p className="text-muted-foreground mt-1">{t.sidebar.packages}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={bulkSyncPackages} disabled={bulkSyncing}>
            {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {t.customers.syncAll}
          </Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> {t.common.add} {t.customers.package}</Button>
        </div>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.table.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                 <TableHead>{t.common.name}</TableHead>
                 <TableHead>{t.portal.speed}</TableHead>
                 <TableHead>{t.billing.billAmount}</TableHead>
                 <TableHead>Bandwidth</TableHead>
                 <TableHead>IP Pool</TableHead>
                 <TableHead>Router</TableHead>
                 <TableHead>MikroTik Profile</TableHead>
                 <TableHead>{t.common.status}</TableHead>
                 <TableHead className="text-right">{t.common.actions}</TableHead>
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
                   <TableCell className="text-sm text-muted-foreground">
                     {(pkg as any).ip_pools?.name ? (
                       <span>{(pkg as any).ip_pools.name} <span className="text-xs">(GW: {(pkg as any).ip_pools.gateway || "—"})</span></span>
                     ) : "—"}
                   </TableCell>
                   <TableCell className="text-sm text-muted-foreground">
                    {(pkg as any).mikrotik_routers?.name || "—"}
                  </TableCell>
                  <TableCell>
                    {pkg.mikrotik_profile_name ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">{pkg.mikrotik_profile_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not synced</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? t.common.active : t.common.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => syncToMikrotik(pkg.id, pkg.router_id)} disabled={syncing === pkg.id} title="Sync to MikroTik">
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
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{t.common.noData}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editPkg ? `${t.common.edit} ${t.customers.package}` : `${t.common.add} ${t.customers.package}`}</DialogTitle></DialogHeader>
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
              <div className="space-y-1.5 mb-4">
                <Label>Target MikroTik Router</Label>
                <Select value={form.router_id} onValueChange={(v) => setForm({ ...form, router_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select router for profile sync" /></SelectTrigger>
                  <SelectContent>
                    {routers?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name} — {r.ip_address}</SelectItem>
                    ))}
                  </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1.5 mb-4">
                 <Label>IP Pool (Remote Address)</Label>
                 <Select value={form.ip_pool_id} onValueChange={(v) => setForm({ ...form, ip_pool_id: v })}>
                   <SelectTrigger><SelectValue placeholder="Select IP Pool for PPP Profile" /></SelectTrigger>
                   <SelectContent>
                     {ipPools?.filter((p: any) => !form.router_id || p.router_id === form.router_id).map((p: any) => (
                       <SelectItem key={p.id} value={p.id}>{p.name} — {p.subnet} (GW: {p.gateway || "N/A"})</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
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
                {editPkg ? t.common.update : t.common.create}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePkg} onOpenChange={() => setDeletePkg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deletePkg?.name}"? This will also remove the MikroTik profile if synced.</AlertDialogDescription>
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
