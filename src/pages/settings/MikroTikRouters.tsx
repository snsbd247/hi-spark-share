import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import api from "@/lib/api";
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
import { Plus, Pencil, Trash2, Loader2, Search, Ban, CheckCircle, Server, Wifi, Download, Users, Package } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MikroTikRouters() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
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
    queryKey: ["mikrotik-routers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mikrotik_routers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = routers?.filter(
    (r) =>
      (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.ip_address || "").includes(search)
  );

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
        const { error } = await supabase.from("mikrotik_routers").update(payload).eq("id", editRouter.id);
        if (error) throw error;
        toast.success("Router updated");
      } else {
        payload.password = form.password;
        const { error } = await supabase.from("mikrotik_routers").insert(payload);
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
      const { error } = await supabase.from("mikrotik_routers").delete().eq("id", deleteRouter.id);
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
    const { error } = await supabase.from("mikrotik_routers").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", router.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Router ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["mikrotik-routers"] });
    }
  };

  const testConnection = async (router: any) => {
    setTesting(router.id);
    try {
      const { data, error } = await supabase.functions.invoke("mikrotik-sync/test-connection", {
        body: { ip_address: router.ip_address, username: router.username, password: router.password, api_port: router.api_port },
      });
      if (error) throw error;
      if (data?.success) toast.success(`Connected! Identity: ${data.identity}, Version: ${data.version}, Uptime: ${data.uptime}`);
      else toast.error(`Connection failed: ${data?.error || "Unknown error"}`);
    } catch (err: any) { toast.error(`Test failed: ${err.message}`); }
    finally { setTesting(null); }
  };

  const importUsers = async (router: any) => {
    setImporting(`users-${router.id}`);
    try {
      const { data } = await api.post('/mikrotik/import-users', { router_id: router.id });
      if (data?.success) {
        toast.success(`Imported ${data.imported} customers, skipped ${data.skipped}`);
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      } else toast.error(data?.error || "Import failed");
    } catch (err: any) { toast.error(`Import failed: ${err.message}`); }
    finally { setImporting(null); }
  };

  const importPackages = async (router: any) => {
    setImporting(`packages-${router.id}`);
    try {
      const { data } = await api.post('/mikrotik/import-packages', { router_id: router.id });
      if (data?.success) {
        toast.success(`Imported ${data.imported} packages, skipped ${data.skipped}`);
        queryClient.invalidateQueries({ queryKey: ["packages"] });
      } else toast.error(data?.error || "Import failed");
    } catch (err: any) { toast.error(`Import failed: ${err.message}`); }
    finally { setImporting(null); }
  };

  const testFormConnection = async () => {
    if (!form.ip_address || !form.username || !form.password) {
      toast.error("Please fill IP, username and password first");
      return;
    }
    setTesting("form");
    try {
      const { data, error } = await supabase.functions.invoke("mikrotik-sync/test-connection", {
        body: {
          ip_address: form.ip_address,
          username: form.username,
          password: form.password,
          api_port: parseInt(form.api_port) || 8728,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Connected! Identity: ${data.identity}, Version: ${data.version}`);
      } else {
        toast.error(`Connection failed: ${data?.error || "Unknown error"}`);
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MikroTik Routers</h1>
          <p className="text-muted-foreground mt-1">Manage MikroTik router connections</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Router</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search routers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>API Port</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
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
                            <Users className="h-4 w-4 mr-2" /> Import Customers
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => importPackages(router)}>
                            <Package className="h-4 w-4 mr-2" /> Import Packages
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
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No routers found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editRouter ? "Edit Router" : "Add Router"}</DialogTitle>
            <DialogDescription>Configure MikroTik router connection settings</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Router Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>IP Address *</Label>
                <Input placeholder="192.168.1.1" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Username *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{editRouter ? "New Password (leave blank to keep)" : "Password *"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editRouter} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>API Port</Label>
                <Input type="number" value={form.api_port} onChange={(e) => setForm({ ...form, api_port: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={testFormConnection} disabled={testing === "form"}>
                {testing === "form" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editRouter ? "Update" : "Add Router"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRouter} onOpenChange={() => setDeleteRouter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Router</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteRouter?.name}"? This action cannot be undone.</AlertDialogDescription>
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
