import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const DB_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "operator", label: "Operator" },
  { value: "technician", label: "Technician" },
  { value: "accountant", label: "Accountant" },
  { value: "staff", label: "Staff" },
];

const MODULE_LABELS: Record<string, string> = {
  customers: "Customers",
  billing: "Billing",
  payments: "Payments",
  merchant_payments: "Merchant Payments",
  tickets: "Tickets",
  sms: "SMS",
  settings: "Settings",
  users: "Users",
  roles: "Roles",
  reports: "Reports",
};

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

export default function RoleManagement() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);
  const [deleteRole, setDeleteRole] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", db_role: "staff" });
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_roles").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch permissions
  const { data: permissions } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permissions").select("*").order("module, action");
      if (error) throw error;
      return data;
    },
  });

  // Fetch role_permissions for editing
  const { data: rolePermissions } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Group permissions by module
  const groupedPermissions = permissions?.reduce((acc: Record<string, any[]>, perm: any) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const openAdd = () => {
    setEditRole(null);
    setForm({ name: "", description: "", db_role: "staff" });
    setSelectedPermissions(new Set());
    setFormOpen(true);
  };

  const openEdit = (role: any) => {
    setEditRole(role);
    setForm({ name: role.name, description: role.description || "", db_role: role.db_role });
    // Load existing permissions for this role
    const perms = rolePermissions?.filter((rp: any) => rp.role_id === role.id).map((rp: any) => rp.permission_id) || [];
    setSelectedPermissions(new Set(perms));
    setFormOpen(true);
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const toggleModuleAll = (module: string) => {
    const modulePerms = permissions?.filter((p: any) => p.module === module) || [];
    const allSelected = modulePerms.every((p: any) => selectedPermissions.has(p.id));
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      modulePerms.forEach((p: any) => {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Role name is required"); return; }
    setLoading(true);
    try {
      let roleId: string;

      if (editRole) {
        const { error } = await supabase.from("custom_roles").update({
          name: form.name,
          description: form.description || null,
          db_role: form.db_role as any,
          updated_at: new Date().toISOString(),
        }).eq("id", editRole.id);
        if (error) throw error;
        roleId = editRole.id;
      } else {
        const { data, error } = await supabase.from("custom_roles").insert({
          name: form.name,
          description: form.description || null,
          db_role: form.db_role as any,
        }).select("id").single();
        if (error) throw error;
        roleId = data.id;
      }

      // Sync permissions: delete all then insert selected
      await supabase.from("role_permissions").delete().eq("role_id", roleId);
      if (selectedPermissions.size > 0) {
        const inserts = Array.from(selectedPermissions).map((pid) => ({
          role_id: roleId,
          permission_id: pid,
        }));
        const { error: permErr } = await supabase.from("role_permissions").insert(inserts);
        if (permErr) throw permErr;
      }

      toast.success(editRole ? "Role updated" : "Role created");
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRole) return;
    try {
      const { error } = await supabase.from("custom_roles").delete().eq("id", deleteRole.id);
      if (error) throw error;
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteRole(null);
    }
  };

  const getPermCount = (roleId: string) => {
    return rolePermissions?.filter((rp: any) => rp.role_id === roleId).length || 0;
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">Manage roles and assign permissions</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Role</Button>
      </div>

      {rolesLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">SL#</TableHead>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>DB Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>System</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles?.map((role: any, i: number) => (
                <TableRow key={role.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{role.description || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{role.db_role}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{getPermCount(role.id)} permissions</Badge></TableCell>
                  <TableCell>{role.is_system ? <Badge>System</Badge> : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!role.is_system && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteRole(role)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!roles || roles.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No roles found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Role Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {editRole ? "Edit Role" : "Create Role"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g., Operator" />
              </div>
              <div className="space-y-1.5">
                <Label>Database Role *</Label>
                <Select value={form.db_role} onValueChange={(v) => setForm({ ...form, db_role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DB_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what this role is for..." rows={2} />
            </div>

            {/* Permissions Grid */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Permissions</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(groupedPermissions).map(([module, perms]) => {
                  const modulePerms = perms as any[];
                  const allSelected = modulePerms.every((p) => selectedPermissions.has(p.id));
                  const someSelected = modulePerms.some((p) => selectedPermissions.has(p.id));
                  return (
                    <Card key={module} className="border-border">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            onCheckedChange={() => toggleModuleAll(module)}
                          />
                          <CardTitle className="text-sm font-semibold">
                            {MODULE_LABELS[module] || module}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 pt-0">
                        <div className="grid grid-cols-2 gap-1.5">
                          {modulePerms.map((perm: any) => (
                            <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                              <Checkbox
                                checked={selectedPermissions.has(perm.id)}
                                onCheckedChange={() => togglePermission(perm.id)}
                              />
                              <span className="text-muted-foreground">{ACTION_LABELS[perm.action] || perm.action}</span>
                            </label>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editRole ? "Update Role" : "Create Role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete the role "{deleteRole?.name}"? Users assigned this role will lose their permissions.</AlertDialogDescription>
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
