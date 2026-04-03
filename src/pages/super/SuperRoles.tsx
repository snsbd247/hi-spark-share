import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Shield, Plus, Edit, Trash2, Loader2, Key, Lock, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface RoleForm {
  name: string;
  description: string;
}

export default function SuperRoles() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [form, setForm] = useState<RoleForm>({ name: "", description: "" });
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [permRoleId, setPermRoleId] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["super-roles"],
    queryFn: async () => {
      const { data } = await db.from("custom_roles").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ["super-permissions"],
    queryFn: async () => {
      const { data } = await db.from("permissions").select("*").order("module").order("action");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingRole) {
        const { error } = await db.from("custom_roles").update({ name: form.name, description: form.description }).eq("id", editingRole.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("custom_roles").insert({ name: form.name, description: form.description, db_role: "staff" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingRole ? "Role updated" : "Role created");
      qc.invalidateQueries({ queryKey: ["super-roles"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await db.from("role_permissions").delete().eq("role_id", id);
      const { error } = await db.from("custom_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["super-roles"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openPermissions = async (role: any) => {
    setPermRoleId(role.id);
    const { data } = await db.from("role_permissions").select("permission_id").eq("role_id", role.id);
    setSelectedPerms((data || []).map((rp: any) => rp.permission_id));
    setPermDialogOpen(true);
  };

  const savePermsMutation = useMutation({
    mutationFn: async () => {
      await db.from("role_permissions").delete().eq("role_id", permRoleId);
      if (selectedPerms.length > 0) {
        const rows = selectedPerms.map((pid) => ({ role_id: permRoleId, permission_id: pid }));
        const { error } = await db.from("role_permissions").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Permissions updated");
      setPermDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePerm = (id: string) => {
    setSelectedPerms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const groupedPerms = permissions.reduce((acc: Record<string, any[]>, p: any) => {
    const mod = p.module || "general";
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(p);
    return acc;
  }, {});

  const toggleModule = (module: string, perms: any[]) => {
    const allSelected = perms.every((p: any) => selectedPerms.includes(p.id));
    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((id) => !perms.find((p: any) => p.id === id)));
    } else {
      setSelectedPerms((prev) => [...new Set([...prev, ...perms.map((p: any) => p.id)])]);
    }
  };

  const openCreate = () => { setEditingRole(null); setForm({ name: "", description: "" }); setDialogOpen(true); };
  const openEdit = (r: any) => { setEditingRole(r); setForm({ name: r.name, description: r.description || "" }); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> {sa.rolesPermissions}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage roles and assign granular permissions</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" /> Create Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: sa.totalRoles, value: roles.length, icon: Shield },
          { label: sa.systemRoles, value: roles.filter((r: any) => r.is_system).length, icon: Lock },
          { label: sa.permissions, value: permissions.length, icon: Key },
        ].map((s, i) => (
          <Card key={i} className="glass-card border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Roles Table */}
      <Card className="glass-card border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{sa.roleName}</TableHead>
                <TableHead>{t.common.description}</TableHead>
                <TableHead>{sa.type}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </TableCell></TableRow>
              ) : roles.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{sa.noRolesFound}</TableCell></TableRow>
              ) : roles.map((r: any) => (
                <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_system ? "default" : "outline"} className="text-xs">
                      {r.is_system ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openPermissions(r)}>
                        <Key className="h-3.5 w-3.5" /> Permissions
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!r.is_system && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Create/Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? sa.editRole : sa.createRole}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{sa.roleName} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Billing Manager" />
            </div>
            <div className="space-y-2">
              <Label>{t.common.description}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Role description" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()} className="bg-gradient-to-r from-primary to-accent">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingRole ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> {sa.assignPermissions}
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={sa.searchPermissions} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <ScrollArea className="h-[55vh] pr-4">
            <div className="space-y-4">
              {Object.entries(groupedPerms)
                .filter(([mod]) => !search || mod.toLowerCase().includes(search.toLowerCase()))
                .map(([module, perms]) => {
                  const allChecked = (perms as any[]).every((p: any) => selectedPerms.includes(p.id));
                  const someChecked = (perms as any[]).some((p: any) => selectedPerms.includes(p.id));
                  return (
                    <Card key={module} className="border-border/40">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={allChecked}
                            className={someChecked && !allChecked ? "opacity-50" : ""}
                            onCheckedChange={() => toggleModule(module, perms as any[])}
                          />
                          <CardTitle className="text-sm font-semibold capitalize">{module.replace(/_/g, " ")}</CardTitle>
                          <Badge variant="outline" className="text-[10px] ml-auto">
                            {(perms as any[]).filter((p: any) => selectedPerms.includes(p.id)).length}/{(perms as any[]).length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {(perms as any[]).map((p: any) => (
                            <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors">
                              <Checkbox checked={selectedPerms.includes(p.id)} onCheckedChange={() => togglePerm(p.id)} />
                              <span className="capitalize">{p.action}</span>
                            </label>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Badge variant="outline" className="mr-auto">
              {selectedPerms.length} / {permissions.length} selected
            </Badge>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={() => savePermsMutation.mutate()} disabled={savePermsMutation.isPending} className="bg-gradient-to-r from-primary to-accent">
              {savePermsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sa.deleteRole}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the role and all its permission assignments.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
