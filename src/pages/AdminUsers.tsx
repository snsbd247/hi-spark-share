import { sessionStore } from "@/lib/sessionStore";
import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { IS_LOVABLE } from "@/lib/environment";
import { db } from "@/integrations/supabase/client";
import { supabaseDirect } from "@/integrations/supabase/client";
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
import { useLanguage } from "@/contexts/LanguageContext";
import type { Database } from "@/integrations/supabase/types";
import { hashPassword } from "@/lib/passwordHash";

type AppRole = Database["public"]["Enums"]["app_role"];

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
      if (IS_LOVABLE) {
        const currentUser = JSON.parse(sessionStore.getItem("admin_user") || "{}");
        const { data: cp } = await db.from("profiles").select("tenant_id").eq("id", currentUser.id).maybeSingle();
        let q: any = db.from("custom_roles").select("*").order("name");
        if (cp?.tenant_id) q = q.eq("tenant_id", cp.tenant_id);
        const { data } = await q;
        return data || [];
      }
      const { data } = await api.get("/custom-roles");
      return Array.isArray(data) ? data : data?.data || [];
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      if (IS_LOVABLE) {
        // Get current user's tenant_id
        const currentUser = JSON.parse(sessionStore.getItem("admin_user") || "{}");
        const { data: currentProfile } = await db.from("profiles").select("tenant_id").eq("id", currentUser.id).maybeSingle();
        const tenantId = currentProfile?.tenant_id;

        let profileQuery = db.from("profiles").select("*").order("full_name");
        if (tenantId) {
          profileQuery = profileQuery.eq("tenant_id", tenantId);
        }
        const { data: profiles } = await profileQuery;
        let rolesQuery: any = db.from("user_roles").select("*");
        // Filter roles to only those belonging to profiles in this tenant
        const profileIds = (profiles || []).map((p: any) => p.id);
        if (profileIds.length > 0) {
          rolesQuery = rolesQuery.in("user_id", profileIds);
        }
        const { data: roles } = await rolesQuery;

        return (profiles || []).map((p: any) => {
          const userRoles = roles?.filter((r: any) => r.user_id === p.id).map((r: any) => r.role) || [];
          const userRoleRow = roles?.find((r: any) => r.user_id === p.id);
          return {
            id: p.id,
            email: p.email || "",
            username: p.username || "",
            full_name: p.full_name || "",
            mobile: p.mobile || "",
            staff_id: p.staff_id || "",
            address: p.address || "",
            avatar_url: p.avatar_url || "",
            role: userRoles[0] || "",
            roles: userRoles,
            custom_role_id: userRoleRow?.custom_role_id || null,
            created_at: p.created_at,
            status: p.status || "active",
            disabled: p.status === "disabled",
            banned: p.status === "disabled",
          };
        }).filter((u: any) => u.roles.length > 0);
      }
      const { data } = await api.get("/admin-users");
      const raw = Array.isArray(data) ? data : data?.data || data?.users || [];
      return raw;
    },
    enabled: !!user,
  });

  const filtered = users?.filter((u: any) => {
    // Non-super_admin users cannot see super_admin users
    const userRole = u.role || u.roles?.[0] || "";
    if (!canViewSuperAdmins && (userRole === "super_admin" || u.roles?.includes("super_admin"))) return false;
    const matchesSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.staff_id?.toLowerCase().includes(search.toLowerCase());
    const userStatus = u.status || "active";
    const isDisabled = userStatus === "disabled" || userStatus === "inactive" || u.disabled || u.banned;
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
      role: u.role || u.roles?.[0] || "staff",
      custom_role_id: u.custom_role_id || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (IS_LOVABLE) {
        if (editUser) {
          const updateData: any = {
            full_name: form.full_name,
            email: form.email || null,
            mobile: form.mobile || null,
            address: form.address || null,
            staff_id: form.staff_id || null,
          };
          if (form.username) updateData.username = form.username;
            if (form.password) {
              updateData.password_hash = hashPassword(form.password);
              if (editUser.id !== user?.id) {
                updateData.must_change_password = true;
              }
            }
            const { error: updateError } = await db.from("profiles").update(updateData).eq("id", editUser.id);
            if (updateError) throw updateError;
          if (form.role) {
            await db.from("user_roles").delete().eq("user_id", editUser.id);
            await db.from("user_roles").insert({
              user_id: editUser.id,
              role: form.role as AppRole,
              custom_role_id: form.custom_role_id || null,
            });
          }
          toast.success("User updated");
        } else {
          if (!form.password) { toast.error("Password is required"); setLoading(false); return; }
          if (!form.username) { toast.error("Username is required"); setLoading(false); return; }

          // Check user limit before creating
          const adminUser = JSON.parse(sessionStore.getItem("admin_user") || "{}");
          const { data: adminProfile } = await db.from("profiles").select("tenant_id").eq("id", adminUser.id).maybeSingle();
          const currentTenantId = adminProfile?.tenant_id;
          if (currentTenantId) {
            const { checkUserLimit } = await import("@/lib/subscriptionHelpers");
            const limitCheck = await checkUserLimit(currentTenantId);
            if (!limitCheck.allowed) {
              toast.error((t as any).limits?.userLimitReached?.replace("{max}", String(limitCheck.max)) || `User limit reached! Max: ${limitCheck.max}`);
              setLoading(false);
              return;
            }
          }
          // Check username uniqueness
          const { data: existing } = await db.from("profiles").select("id").eq("username", form.username).maybeSingle();
          if (existing) { toast.error("Username already taken"); setLoading(false); return; }
          const newId = crypto.randomUUID();
          const { error: insertError } = await db.from("profiles").insert({
            id: newId,
            full_name: form.full_name,
            username: form.username,
            email: form.email || null,
            mobile: form.mobile || null,
            address: form.address || null,
            staff_id: form.staff_id || null,
            password_hash: hashPassword(form.password),
            status: "active",
            must_change_password: true,
            tenant_id: adminProfile?.tenant_id || null,
          });
          if (insertError) throw insertError;
          if (form.role) {
            await db.from("user_roles").insert({
              user_id: newId,
              role: form.role as AppRole,
              custom_role_id: form.custom_role_id || null,
            });
          }
          toast.success("User created");
        }
      } else {
        if (editUser) {
          await api.put(`/admin-users/${editUser.id}`, {
            full_name: form.full_name,
            username: form.username,
            email: form.email,
            password: form.password || undefined,
            mobile: form.mobile,
            address: form.address,
            staff_id: form.staff_id,
            role: form.role,
            custom_role_id: form.custom_role_id || undefined,
          });
          toast.success("User updated");
        } else {
          if (!form.password) { toast.error("Password is required"); setLoading(false); return; }
          if (!form.username) { toast.error("Username is required"); setLoading(false); return; }
          await api.post("/admin-users", {
            full_name: form.full_name,
            username: form.username,
            email: form.email,
            password: form.password,
            mobile: form.mobile,
            address: form.address,
            staff_id: form.staff_id,
            role: form.role,
            custom_role_id: form.custom_role_id || undefined,
          });
          toast.success("User created");
        }
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      if (IS_LOVABLE) {
        await db.from("user_roles").delete().eq("user_id", deleteUser.id);
        await db.from("profiles").delete().eq("id", deleteUser.id);
      } else {
        await api.delete(`/admin-users/${deleteUser.id}`);
      }
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || err.message);
    } finally {
      setDeleteUser(null);
    }
  };

  const toggleDisable = async (u: any) => {
    const currentStatus = u.status || "active";
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      if (IS_LOVABLE) {
        await db.from("profiles").update({ status: newStatus }).eq("id", u.id);
      } else {
        await api.put(`/admin-users/${u.id}`, {
          full_name: u.full_name,
          username: u.username,
          status: newStatus,
        });
      }
      toast.success(`User ${newStatus === "disabled" ? "disabled" : "enabled"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || err.message);
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
    return u.role || u.roles?.[0] || "No role";
  };

  const getUserRole = (u: any) => u.role || u.roles?.[0] || "";
  const isUserDisabled = (u: any) => {
    const s = u.status || "active";
    return s === "disabled" || s === "inactive" || u.disabled || u.banned;
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.adminUsers.title}</h1>
          <p className="text-muted-foreground mt-1">{t.adminUsers.subtitle}</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> {t.adminUsers.addUser}</Button>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.adminUsers.searchUsers} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.adminUsers.allStatus}</SelectItem>
            <SelectItem value="active">{t.common.active}</SelectItem>
            <SelectItem value="disabled">{t.adminUsers.disabled}</SelectItem>
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
                <TableHead>{t.adminUsers.fullName}</TableHead>
                <TableHead>{t.adminUsers.username}</TableHead>
                <TableHead>{t.common.email}</TableHead>
                <TableHead>{t.adminUsers.mobile}</TableHead>
                <TableHead>{t.adminUsers.staffId}</TableHead>
                <TableHead>{t.adminUsers.role}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{t.adminUsers.created}</TableHead>
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
                    <Badge variant="outline" className={roleColor(getUserRole(u))}>
                      {getRoleName(u)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isUserDisabled(u) ? "secondary" : "default"}>
                      {isUserDisabled(u) ? t.adminUsers.disabled : t.common.active}
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
                        {isUserDisabled(u) ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteUser(u)} disabled={u.id === user?.id}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{t.adminUsers.noUsersFound}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editUser ? t.adminUsers.editUser : t.adminUsers.addUser}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.adminUsers.fullName} *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t.adminUsers.username} *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="unique username" autoComplete="off" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.common.email}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{editUser ? t.adminUsers.newPasswordHint : `${t.adminUsers.password} *`}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editUser} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.adminUsers.mobile}</Label>
                <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.adminUsers.staffId}</Label>
                <Input value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.common.address}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.adminUsers.role} *</Label>
              <Select value={form.custom_role_id || form.role} onValueChange={(v) => {
                const customRole = customRoles?.find((cr: any) => cr.id === v);
                if (customRole) {
                  setForm({ ...form, custom_role_id: customRole.id, role: customRole.db_role });
                } else {
                  setForm({ ...form, role: v, custom_role_id: "" });
                }
              }}>
                <SelectTrigger><SelectValue placeholder={t.adminUsers.selectRole} /></SelectTrigger>
                <SelectContent>
                {customRoles && customRoles.length > 0 ? (
                  customRoles.filter((cr: any) => canViewSuperAdmins || cr.db_role !== "super_admin").map((cr: any) => (
                    <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                  ))
                ) : (
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
                {editUser ? t.common.update : t.common.create}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.adminUsers.deleteUser}</AlertDialogTitle>
            <AlertDialogDescription>{t.adminUsers.deleteUserConfirm.replace("{name}", deleteUser?.full_name || deleteUser?.username || "")}</AlertDialogDescription>
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
