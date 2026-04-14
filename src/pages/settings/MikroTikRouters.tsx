import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, supabaseDirect } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import api from "@/lib/api";
import { IS_LOVABLE } from "@/lib/environment";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, Loader2, Search, Ban, CheckCircle, Server, Wifi, Download, Users, Package, Globe } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MikroTikRouters() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const [formOpen, setFormOpen] = useState(false);
  const [editRouter, setEditRouter] = useState<any>(null);
  const [deleteRouter, setDeleteRouter] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", ip_address: "", username: "admin", password: "", api_port: "8728", description: "",
  });

  const { data: routers, isLoading } = useQuery({
    queryKey: ["mikrotik-routers", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeByTenant(db.from("mikrotik_routers").select("*").order("created_at", { ascending: false }), tenantId);
      if (error) throw error;
      return data;
    },
  });

  const filtered = routers?.filter(
    (r) =>
      (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.ip_address || "").includes(search)
  );

  const getLovableRouterPayload = (router: any) => ({
    router_id: router.id,
    name: router.name,
    ip_address: router.ip_address,
    username: router.username,
    password: router.password,
    api_port: router.api_port,
    tenant_id: tenantId || undefined,
  });

  const openAdd = () => {
    setEditRouter(null);
    setForm({ name: "", ip_address: "", username: "admin", password: "", api_port: "8728", description: "" });
    setFormOpen(true);
  };

  const openEdit = (router: any) => {
    setEditRouter(router);
    setForm({
      name: router.name,
      ip_address: router.ip_address,
      username: router.username,
      password: "",
      api_port: router.api_port.toString(),
      description: router.description || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        name: form.name,
        ip_address: form.ip_address,
        username: form.username,
        api_port: parseInt(form.api_port) || 8728,
        description: form.description || null,
        updated_at: new Date().toISOString(),
      };

      if (editRouter) {
        if (form.password) payload.password = form.password;
        const { error } = await db.from("mikrotik_routers").update(payload).eq("id", editRouter.id);
        if (error) throw error;
        toast.success("Router updated");
      } else {
        payload.password = form.password;
        if (tenantId) payload.tenant_id = tenantId;
        const { error } = await db.from("mikrotik_routers").insert(payload);
        if (error) throw error;
        toast.success("Router added");
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["mikrotik-routers"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRouter) return;
    try {
      const { error } = await db.from("mikrotik_routers").delete().eq("id", deleteRouter.id);
      if (error) throw error;
      toast.success("Router deleted");
      queryClient.invalidateQueries({ queryKey: ["mikrotik-routers"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteRouter(null);
    }
  };

  const toggleStatus = async (router: any) => {
    const newStatus = router.status === "active" ? "disabled" : "active";
    const { error } = await db.from("mikrotik_routers").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", router.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Router ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["mikrotik-routers"] });
    }
  };

  const testConnection = async (router: any) => {
    setTesting(router.id);
    try {
      if (IS_LOVABLE) {
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/test-connection', {
          body: { ip_address: router.ip_address, username: router.username, password: router.password, api_port: router.api_port },
        });
        if (error) throw error;
        if (data?.success) toast.success(data.identity ? `Connected! Router: ${data.identity}, Version: ${data.version}` : "Connected successfully!");
        else toast.error(data?.error || "Connection failed");
      } else {
        const { data: resp } = await api.post('/mikrotik/test-connection', { router_id: router.id });
        if (resp?.success) toast.success(resp.message || "Connected successfully!");
        else toast.error(resp?.message || "Connection failed");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      if (IS_LOVABLE && (msg?.includes("Connection refused") || msg?.includes("timeout"))) {
        toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট পাবলিকলি ওপেন করুন অথবা cPanel ব্যাকএন্ড থেকে চেষ্টা করুন।", { duration: 8000 });
      } else {
        toast.error(`Test failed: ${msg}`);
      }
    } finally { setTesting(null); }
  };

  const importUsers = async (router: any) => {
    setImporting(`users-${router.id}`);
    try {
      if (IS_LOVABLE) {
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/import-users', {
          body: getLovableRouterPayload(router),
        });
        if (error) throw error;
        if (data?.success) {
          if (data.errors?.length && (data.imported || 0) === 0) {
            const errMsg = data.errors[0] || "";
            if (errMsg.includes("Connection refused") || errMsg.includes("timeout")) {
              toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট Supabase সার্ভার থেকে অ্যাক্সেসযোগ্য হতে হবে।", { duration: 8000 });
            } else {
              toast.error(`Import failed: ${errMsg}`);
            }
          } else {
            toast.success(`Imported ${data.imported || 0} customers, skipped ${data.skipped || 0}`);
            queryClient.invalidateQueries({ queryKey: ["customers"] });
          }
        } else toast.error(data?.error || "Import failed");
      } else {
        const { data } = await api.post('/mikrotik/import-users', { router_id: router.id });
        if (data?.success) {
          toast.success(`Imported ${data.imported} customers, skipped ${data.skipped}`);
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        } else toast.error(data?.error || "Import failed");
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (IS_LOVABLE && (msg.includes("Connection refused") || msg.includes("timeout"))) {
        toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট পাবলিকলি ওপেন করুন।", { duration: 8000 });
      } else {
        toast.error(`Import failed: ${msg}`);
      }
    }
    finally { setImporting(null); }
  };

  const importPackages = async (router: any) => {
    setImporting(`packages-${router.id}`);
    try {
      if (IS_LOVABLE) {
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/import-packages', {
          body: getLovableRouterPayload(router),
        });
        if (error) throw error;
        if (data?.success) {
          if (data.errors?.length && (data.imported || 0) === 0) {
            const errMsg = data.errors[0] || "";
            if (errMsg.includes("Connection refused") || errMsg.includes("timeout")) {
              toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট Supabase সার্ভার থেকে অ্যাক্সেসযোগ্য হতে হবে।", { duration: 8000 });
            } else {
              toast.error(`Import failed: ${errMsg}`);
            }
          } else {
            toast.success(`Imported ${data.imported || 0} packages, skipped ${data.skipped || 0}`);
            queryClient.invalidateQueries({ queryKey: ["packages"] });
          }
        } else toast.error(data?.error || "Import failed");
      } else {
        const { data } = await api.post('/mikrotik/import-packages', { router_id: router.id });
        if (data?.success) {
          toast.success(`Imported ${data.imported} packages, skipped ${data.skipped}`);
          queryClient.invalidateQueries({ queryKey: ["packages"] });
        } else toast.error(data?.error || "Import failed");
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (IS_LOVABLE && (msg.includes("Connection refused") || msg.includes("timeout"))) {
        toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট পাবলিকলি ওপেন করুন।", { duration: 8000 });
      } else {
        toast.error(`Import failed: ${msg}`);
      }
    }
    finally { setImporting(null); }
  };

  const importIpPools = async (router: any) => {
    setImporting(`pools-${router.id}`);
    try {
      if (IS_LOVABLE) {
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/sync-ip-pools', {
          body: getLovableRouterPayload(router),
        });
        if (error) throw error;
        if (data?.success) {
          toast.success(`Synced ${data.synced || 0} IP Pools`);
          queryClient.invalidateQueries({ queryKey: ["ip-pools"] });
        } else toast.error(data?.error || "IP Pool import failed");
      } else {
        const { data } = await api.post('/mikrotik/sync-ip-pools', { router_id: router.id });
        if (data?.success) {
          toast.success(`Synced ${data.synced || 0} IP Pools`);
          queryClient.invalidateQueries({ queryKey: ["ip-pools"] });
        } else toast.error(data?.error || "IP Pool import failed");
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (IS_LOVABLE && (msg.includes("Connection refused") || msg.includes("timeout"))) {
        toast.error("রাউটারে কানেক্ট হচ্ছে না। MikroTik API পোর্ট পাবলিকলি ওপেন করুন।", { duration: 8000 });
      } else {
        toast.error(`Import failed: ${msg}`);
      }
    } finally { setImporting(null); }
  };

  const testFormConnection = async () => {
    if (!form.ip_address || !form.username || !form.password) {
      toast.error("Please fill IP, username and password first");
      return;
    }
    setTesting("form");
    try {
      const payload = {
        ip_address: form.ip_address,
        username: form.username,
        password: form.password,
        api_port: parseInt(form.api_port) || 8728,
      };
      if (IS_LOVABLE) {
        const { data, error } = await supabaseDirect.functions.invoke('mikrotik-sync/test-connection', {
          body: payload,
        });
        if (error) throw error;
        if (data?.success) toast.success(data.identity ? `Connected! Router: ${data.identity}` : "Connected successfully!");
        else toast.error(data?.error || "Connection failed");
      } else {
        const { data: resp } = await api.post('/mikrotik/test-connection', {
          host: form.ip_address,
          username: form.username,
          password: form.password,
          port: parseInt(form.api_port) || 8728,
        });
        if (resp?.success) toast.success(resp.message || "Connected successfully!");
        else toast.error(resp?.message || "Connection failed");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`Test failed: ${msg}`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.mikrotik.title}</h1>
          <p className="text-muted-foreground mt-1">{t.mikrotik.subtitle}</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> {t.mikrotik.addRouter}</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.mikrotik.searchRouters} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.common.name}</TableHead>
                <TableHead>{t.mikrotik.ipAddress}</TableHead>
                <TableHead>{t.mikrotik.username}</TableHead>
                <TableHead>{t.mikrotik.apiPort}</TableHead>
                <TableHead>{t.common.description}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((router) => (
                <TableRow key={router.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      {router.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{router.ip_address}</TableCell>
                  <TableCell>{router.username}</TableCell>
                  <TableCell>{router.api_port}</TableCell>
                  <TableCell className="text-muted-foreground">{router.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={router.status === "active" ? "default" : "secondary"}>{router.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => testConnection(router)} disabled={testing === router.id}>
                        {testing === router.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!importing}>
                            {importing?.includes(router.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => importUsers(router)}>
                            <Users className="h-4 w-4 mr-2" /> {t.mikrotik.importCustomers}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => importPackages(router)}>
                            <Package className="h-4 w-4 mr-2" /> {t.mikrotik.importPackages}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => importIpPools(router)}>
                            <Globe className="h-4 w-4 mr-2" /> {t.mikrotik.importIpPools || "Import IP Pools"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(router)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(router)}>
                        {router.status === "active" ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteRouter(router)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered?.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t.mikrotik.noRoutersFound}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editRouter ? t.mikrotik.editRouter : t.mikrotik.addRouter}</DialogTitle>
            <DialogDescription>{t.mikrotik.configureConnection}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.mikrotik.routerName} *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t.mikrotik.ipAddress} *</Label>
                <Input placeholder="192.168.1.1" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.mikrotik.username} *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{editRouter ? t.mikrotik.newPasswordHint : `${t.adminUsers.password} *`}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editRouter} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.mikrotik.apiPort}</Label>
                <Input type="number" value={form.api_port} onChange={(e) => setForm({ ...form, api_port: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.common.description}</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={testFormConnection} disabled={testing === "form"}>
                {testing === "form" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                {t.mikrotik.testConnection}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editRouter ? t.common.update : t.mikrotik.addRouter}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRouter} onOpenChange={() => setDeleteRouter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.mikrotik.deleteRouter}</AlertDialogTitle>
            <AlertDialogDescription>{t.mikrotik.deleteRouterConfirm.replace("{name}", deleteRouter?.name || "")}</AlertDialogDescription>
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
