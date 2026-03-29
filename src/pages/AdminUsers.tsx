import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
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
import { Plus, Pencil, Trash2, Loader2, Search, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminUsers() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const normalizedUserRole = (typeof user?.role === 'string' ? user.role : '').toLowerCase().replace(/[\s-]+/g, "_");
  const canViewSuperAdmins = isSuperAdmin || normalizedUserRole === "super_admin" || normalizedUserRole === "superadmin";
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteUser, setDeleteUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    full_name: "", username: "", email: "", password: "", mobile: "", address: "", staff_id: "", role: "staff", custom_role_id: "",
  });

  // Fetch custom roles for assignment
  const { data: customRoles } = useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_roles").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-users/list", {
        body: {},
        headers: getAuthHeaders(),
      });
      if (error) throw error;
      return data?.users || [];
    },
    enabled: !!user,
  });

  const filtered = users?.filter((u: any) => {
    // Non-super_admin users cannot see super_admin users
    if (!canViewSuperAdmins && u.roles?.includes("super_admin")) return false;
    const matchesSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.staff_id?.toLowerCase().includes(search.toLowerCase());
    const isDisabled = u.disabled || u.banned;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !isDisabled) ||
      (statusFilter === "disabled" && isDisabled);
    return matchesSearch && matchesStatus;
  });

  const openAdd = () => {
    setEditUser(null);
    setForm({ full_name: "", username: "", email: "", password: "", mobile: "", address: "", staff_id: "", role: "staff", custom_role_id: "" });
    setFormOpen(true);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setForm({
      full_name: u.full_name || "",
      username: u.username || "",
      email: u.email || "",
      password: "",
      mobile: u.mobile || "",
      address: u.address || "",
      staff_id: u.staff_id || "",
      role: u.roles?.[0] || "staff",
      custom_role_id: u.custom_role_id || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editUser) {
        const { data, error } = await supabase.functions.invoke("admin-users/update", {
            body: {
              user_id: editUser.id,
              full_name: form.full_name,
              username: form.username,
              email: form.email,
              password: form.password || undefined,
              mobile: form.mobile,
              address: form.address,
              staff_id: form.staff_id,
              role: form.role,
              custom_role_id: form.custom_role_id || undefined,
            },
            headers: getAuthHeaders(),
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("User updated");
      } else {
        if (!form.password) { toast.error("Password is required"); setLoading(false); return; }
        if (!form.username) { toast.error("Username is required"); setLoading(false); return; }
        const { data, error } = await supabase.functions.invoke("admin-users/create", {
            body: {
              full_name: form.full_name,
              username: form.username,
              email: form.email,
              password: form.password,
              mobile: form.mobile,
              address: form.address,
              staff_id: form.staff_id,
              role: form.role,
              custom_role_id: form.custom_role_id || undefined,
            },
            headers: getAuthHeaders(),
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("User created");
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users/delete", {
        body: { user_id: deleteUser.id },
        headers: getAuthHeaders(),
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteUser(null);
    }
  };

  const toggleDisable = async (u: any) => {
    const newDisabled = !u.disabled && !u.banned;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users/update", {
        body: { user_id: u.id, disabled: newDisabled, full_name: u.full_name, username: u.username, mobile: u.mobile, address: u.address, staff_id: u.staff_id, role: u.roles?.[0] || "staff" },
        headers: getAuthHeaders(),
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`User ${newDisabled ? "disabled" : "enabled"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-primary/10 text-primary border-primary/20";
      case "admin": return "bg-accent/50 text-accent-foreground border-accent";
      case "manager": return "bg-chart-1/10 text-chart-1 border-chart-1/20";
      case "operator": return "bg-chart-2/10 text-chart-2 border-chart-2/20";
      case "technician": return "bg-chart-3/10 text-chart-3 border-chart-3/20";
      case "accountant": return "bg-chart-4/10 text-chart-4 border-chart-4/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getRoleName = (u: any) => {
    if (u.custom_role_id && customRoles) {
      const cr = customRoles.find((r: any) => r.id === u.custom_role_id);
      if (cr) return cr.name;
    }
    return u.roles?.[0] || "No role";
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground mt-1">Manage admin & staff accounts</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add User</Button>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">SL#</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Staff ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((u: any, i: number) => (
                <TableRow key={u.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{u.username || <span className="text-destructive text-xs">Not set</span>}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.mobile || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{u.staff_id || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={roleColor(u.roles?.[0] || "")}>
                      {getRoleName(u)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.disabled || u.banned ? "secondary" : "default"}>
                      {u.disabled || u.banned ? "Disabled" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.created_at ? safeFormat(u.created_at, "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleDisable(u)} disabled={u.id === user?.id}>
                        {u.disabled || u.banned ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteUser(u)} disabled={u.id === user?.id}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editUser ? "Edit User" : "Add User"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Username *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="unique username" autoComplete="off" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{editUser ? "New Password (leave blank to keep)" : "Password *"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editUser} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Staff ID</Label>
                <Input value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.custom_role_id || form.role} onValueChange={(v) => {
                // Find if it's a custom role id
                const customRole = customRoles?.find((cr: any) => cr.id === v);
                if (customRole) {
                  setForm({ ...form, custom_role_id: customRole.id, role: customRole.db_role });
                } else {
                  setForm({ ...form, role: v, custom_role_id: "" });
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                {customRoles?.filter((cr: any) => canViewSuperAdmins || cr.db_role !== "super_admin").map((cr: any) => (
                    <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                  )) || (
                    <>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {canViewSuperAdmins && <SelectItem value="super_admin">Super Admin</SelectItem>}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editUser ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteUser?.full_name || deleteUser?.username}"? This action cannot be undone.</AlertDialogDescription>
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
