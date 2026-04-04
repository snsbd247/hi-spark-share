import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { supabase as supabaseDirect } from "@/integrations/supabase/client";
import api from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Network, Globe, RefreshCw, Upload, Router, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const IS_LOVABLE = window.location.hostname.includes("lovable.app") || window.location.hostname.includes("lovableproject.com");

export default function IpPoolManagement() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);

  const emptyForm = { name: "", subnet: "", gateway: "", start_ip: "", end_ip: "", total_ips: 0, type: "pppoe", router_id: "" };
  const [form, setForm] = useState(emptyForm);

  const { data: pools = [] } = useQuery({
    queryKey: ["ip-pools", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("ip_pools").select("*, mikrotik_routers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: routers = [] } = useQuery({
    queryKey: ["mikrotik-routers-list", tenantId],
    queryFn: async () => {
      const { data, error } = await db.from("mikrotik_routers").select("id, name, ip_address, status").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (d: typeof form) => {
      const ranges = d.start_ip && d.end_ip ? `${d.start_ip}-${d.end_ip}` : d.subnet;
      const insertData: any = {
        name: d.name, subnet: d.subnet || ranges, gateway: d.gateway,
        start_ip: d.start_ip, end_ip: d.end_ip, total_ips: d.total_ips || 0,
        type: d.type, ranges,
      };
      if (d.router_id) insertData.router_id = d.router_id;
      const { error } = await db.from("ip_pools").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip-pools", tenantId] });
      toast.success(t.ipPool.poolCreated);
      setOpen(false);
      setEditingPool(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      const ranges = data.start_ip && data.end_ip ? `${data.start_ip}-${data.end_ip}` : data.subnet;
      const updateData: any = {
        name: data.name, subnet: data.subnet || ranges, gateway: data.gateway,
        start_ip: data.start_ip, end_ip: data.end_ip, total_ips: data.total_ips || 0,
        type: data.type, ranges,
      };
      if (data.router_id) updateData.router_id = data.router_id;
      else updateData.router_id = null;
      const { error } = await db.from("ip_pools").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip-pools", tenantId] });
      toast.success(t.ipPool.poolUpdated || "Pool updated");
      setOpen(false);
      setEditingPool(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("ip_pools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ip-pools", tenantId] }); toast.success(t.ipPool.deleted); },
  });

  const handleSyncFromRouter = async (routerId: string) => {
    setSyncing(true);
    try {
      if (IS_LOVABLE) {
        const router = routers.find((r: any) => r.id === routerId);
        if (!router) throw new Error("Router not found");
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/sync-ip-pools', {
          body: { router_id: routerId, ip_address: router.ip_address },
        });
        if (error) throw error;
        if (data?.success) {
          toast.success(`${data.synced} ${t.ipPool.syncSuccess}`);
        } else {
          toast.error(data?.error || t.ipPool.syncFailed);
        }
      } else {
        const { data } = await api.post('/mikrotik/sync-ip-pools', { router_id: routerId });
        if (data?.success) {
          toast.success(`${data.synced} ${t.ipPool.syncSuccess}`);
        } else {
          toast.error(data?.error || t.ipPool.syncFailed);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["ip-pools", tenantId] });
    } catch (e: any) {
      toast.error(e.message || t.ipPool.syncFailed);
    } finally {
      setSyncing(false);
    }
  };

  const handlePushToRouter = async (poolId: string) => {
    setPushingId(poolId);
    try {
      if (IS_LOVABLE) {
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/push-ip-pool', {
          body: { pool_id: poolId },
        });
        if (error) throw error;
        if (data?.success) toast.success(data.message || t.ipPool.pushSuccess);
        else toast.error(data?.error || t.ipPool.pushFailed);
      } else {
        const { data } = await api.post('/mikrotik/push-ip-pool', { pool_id: poolId });
        if (data?.success) toast.success(data.message || t.ipPool.pushSuccess);
        else toast.error(data?.error || t.ipPool.pushFailed);
      }
    } catch (e: any) {
      toast.error(e.message || t.ipPool.pushFailed);
    } finally {
      setPushingId(null);
    }
  };

  const handlePushAllToRouter = async (routerId: string) => {
    setPushingAll(true);
    try {
      if (IS_LOVABLE) {
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/push-all-ip-pools', {
          body: { router_id: routerId },
        });
        if (error) throw error;
        if (data?.success) toast.success(`${data.pushed} ${t.ipPool.pushSuccess}`);
        else toast.error(data?.error || t.ipPool.pushFailed);
      } else {
        const { data } = await api.post('/mikrotik/push-all-ip-pools', { router_id: routerId });
        if (data?.success) toast.success(`${data.pushed} ${t.ipPool.pushSuccess}`);
        else toast.error(data?.error || t.ipPool.pushFailed);
      }
    } catch (e: any) {
      toast.error(e.message || t.ipPool.pushFailed);
    } finally {
      setPushingAll(false);
    }
  };

  const activeRouters = routers.filter((r: any) => r.status === "active");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t.ipPool.title}</h1>
            <p className="text-sm text-muted-foreground">{t.ipPool.subtitle}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeRouters.length > 0 && (
              <Select onValueChange={(v) => handleSyncFromRouter(v)} disabled={syncing}>
                <SelectTrigger className="w-[200px]">
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                    <span>{syncing ? t.ipPool.syncing : t.ipPool.syncFromRouter}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {activeRouters.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <Router className="h-3 w-3" />
                        {r.name} ({r.ip_address})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeRouters.length > 0 && pools.length > 0 && (
              <Select onValueChange={(v) => handlePushAllToRouter(v)} disabled={pushingAll}>
                <SelectTrigger className="w-[200px]">
                  <div className="flex items-center gap-2">
                    <Upload className={`h-4 w-4 ${pushingAll ? "animate-spin" : ""}`} />
                    <span>{pushingAll ? t.ipPool.pushing : t.ipPool.pushToRouter}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {activeRouters.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <Router className="h-3 w-3" />
                        {r.name} ({r.ip_address})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingPool(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> {t.ipPool.addPool}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editingPool ? (t.ipPool.editPool || "Edit Pool") : t.ipPool.createPool}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t.ipPool.poolName}</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="pool-1" />
                  </div>
                  <div>
                    <Label>{t.ipPool.type}</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pppoe">PPPoE</SelectItem>
                        <SelectItem value="hotspot">Hotspot</SelectItem>
                        <SelectItem value="dhcp">DHCP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.ipPool.router}</Label>
                    <Select value={form.router_id} onValueChange={v => setForm(f => ({ ...f, router_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={t.ipPool.selectRouter} /></SelectTrigger>
                      <SelectContent>
                        {routers.map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>{r.name} ({r.ip_address})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.ipPool.subnet}</Label>
                    <Input value={form.subnet} onChange={e => setForm(f => ({ ...f, subnet: e.target.value }))} placeholder="192.168.1.0/24" />
                  </div>
                  <div>
                    <Label>{t.ipPool.gateway}</Label>
                    <Input value={form.gateway} onChange={e => setForm(f => ({ ...f, gateway: e.target.value }))} placeholder="192.168.1.1" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t.ipPool.startIp}</Label>
                      <Input value={form.start_ip} onChange={e => setForm(f => ({ ...f, start_ip: e.target.value }))} placeholder="192.168.1.10" />
                    </div>
                    <div>
                      <Label>{t.ipPool.endIp}</Label>
                      <Input value={form.end_ip} onChange={e => setForm(f => ({ ...f, end_ip: e.target.value }))} placeholder="192.168.1.254" />
                    </div>
                  </div>
                  <div>
                    <Label>{t.ipPool.totalIps}</Label>
                    <Input type="number" value={form.total_ips} onChange={e => setForm(f => ({ ...f, total_ips: Number(e.target.value) }))} />
                  </div>
                  {editingPool ? (
                    <Button
                      onClick={() => updateMutation.mutate({ id: editingPool.id, data: form })}
                      disabled={!form.name || updateMutation.isPending}
                      className="w-full"
                    >
                      {t.ipPool.editPool || "Edit Pool"}
                    </Button>
                  ) : (
                    <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending} className="w-full">
                      {t.ipPool.createPool}
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Pool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map((pool: any) => {
            const usage = pool.total_ips > 0 ? Math.round((pool.used_ips / pool.total_ips) * 100) : 0;
            const routerName = pool.mikrotik_routers?.name;
            return (
              <Card key={pool.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Network className="h-4 w-4" /> {pool.name}
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      {pool.type && (
                        <Badge variant="outline" className="text-xs capitalize">{pool.type}</Badge>
                      )}
                      <Badge variant={pool.status === "active" ? "default" : "secondary"}>{pool.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.ipPool.subnet}:</span>
                      <span className="font-mono text-xs">{pool.subnet || pool.ranges || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.ipPool.gateway}:</span>
                      <span className="font-mono">{pool.gateway || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.ipPool.range}:</span>
                      <span className="font-mono text-xs">
                        {pool.start_ip && pool.end_ip ? `${pool.start_ip} - ${pool.end_ip}` : pool.ranges || "-"}
                      </span>
                    </div>
                    {routerName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t.ipPool.router}:</span>
                        <span className="text-xs font-medium">{routerName}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{pool.used_ips}/{pool.total_ips} {t.ipPool.used}</span><span>{usage}%</span>
                    </div>
                    <Progress value={usage} className={`h-2 ${usage > 90 ? "[&>div]:bg-destructive" : ""}`} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePushToRouter(pool.id)}
                      disabled={pushingId === pool.id || !pool.router_id}
                    >
                      <Upload className={`h-3 w-3 mr-1 ${pushingId === pool.id ? "animate-spin" : ""}`} />
                      {pushingId === pool.id ? t.ipPool.pushing : t.ipPool.push}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPool(pool);
                        setForm({
                          name: pool.name || "",
                          subnet: pool.subnet || "",
                          gateway: pool.gateway || "",
                          start_ip: pool.start_ip || "",
                          end_ip: pool.end_ip || "",
                          total_ips: pool.total_ips || 0,
                          type: pool.type || "pppoe",
                          router_id: pool.router_id || "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(pool.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!pools.length && (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                {t.ipPool.noPoolsConfigured}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
