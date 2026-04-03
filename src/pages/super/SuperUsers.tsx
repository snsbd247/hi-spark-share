import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { hashPassword } from "@/lib/passwordHash";
import {
  Users, Plus, Search, Edit, Trash2, Shield, Key, Eye, EyeOff,
  UserPlus, Loader2, ChevronDown, Lock, Mail, Phone, MapPin, BadgeCheck
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserForm {
  full_name: string;
  email: string;
  username: string;
  mobile: string;
  address: string;
  staff_id: string;
  password: string;
  role: string;
  custom_role_id: string;
  status: string;
}

const emptyForm: UserForm = {
  full_name: "", email: "", username: "", mobile: "", address: "",
  staff_id: "", password: "", role: "staff", custom_role_id: "", status: "active",
};

export default function SuperUsers() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [showPw, setShowPw] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch users with roles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["super-users"],
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      // fetch roles
      const userIds = (data || []).map((u: any) => u.id);
      if (!userIds.length) return [];
      const { data: roles } = await db.from("user_roles").select("*").in("user_id", userIds);
      return (data || []).map((u: any) => {
        const r = (roles || []).find((ro: any) => ro.user_id === u.id);
        return { ...u, role: r?.role || "staff", custom_role_id: r?.custom_role_id || null };
      });
    },
  });

  // Fetch custom roles
  const { data: customRoles = [] } = useQuery({
    queryKey: ["super-custom-roles"],
    queryFn: async () => {
      const { data } = await db.from("custom_roles").select("*").order("name");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (isEdit: boolean) => {
      if (isEdit && editingUser) {
        const updateData: any = {
          full_name: form.full_name,
          email: form.email,
          mobile: form.mobile,
          address: form.address,
          staff_id: form.staff_id,
          status: form.status,
        };
        if (form.password) {
          updateData.password_hash = hashPassword(form.password);
        }
        const { error } = await db.from("profiles").update(updateData).eq("id", editingUser.id);
        if (error) throw error;

        // Update role
        await db.from("user_roles").delete().eq("user_id", editingUser.id);
        const { error: roleErr } = await db.from("user_roles").insert({
          user_id: editingUser.id,
          role: form.role as any,
          custom_role_id: form.custom_role_id || null,
        });
        if (roleErr) throw roleErr;
      } else {
        if (!form.password) throw new Error("Password is required");
        if (!form.username) throw new Error("Username is required");
        const newId = crypto.randomUUID();
        const { error } = await db.from("profiles").insert({
          id: newId,
          full_name: form.full_name,
          email: form.email,
          username: form.username,
          mobile: form.mobile,
          address: form.address,
          staff_id: form.staff_id,
          password_hash: hashPassword(form.password),
          status: form.status,
        } as any);
        if (error) throw error;

        const { error: roleErr } = await db.from("user_roles").insert({
          user_id: newId,
          role: form.role as any,
          custom_role_id: form.custom_role_id || null,
        });
        if (roleErr) throw roleErr;
      }
    },
    onSuccess: () => {
      toast.success(editingUser ? "User updated" : "User created");
      qc.invalidateQueries({ queryKey: ["super-users"] });
      setDialogOpen(false);
      setEditingUser(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save user"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await db.from("user_roles").delete().eq("user_id", id);
      const { error } = await db.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["super-users"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowPw(false);
    setDialogOpen(true);
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      username: user.username || "",
      mobile: user.mobile || "",
      address: user.address || "",
      staff_id: user.staff_id || "",
      password: "",
      role: user.role || "staff",
      custom_role_id: user.custom_role_id || "",
      status: user.status || "active",
    });
    setShowPw(false);
    setDialogOpen(true);
  };

  const filtered = users.filter((u: any) =>
    [u.full_name, u.email, u.username, u.mobile, u.role].some(
      (v) => v && v.toLowerCase().includes(search.toLowerCase())
    )
  );

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "admin": case "owner": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "manager": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {sa.userManagement}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system users, roles, and access</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20">
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: sa.totalUsers, value: users.length, icon: Users },
          { label: t.common.active, value: users.filter((u: any) => u.status === "active").length, icon: BadgeCheck },
          { label: sa.admins, value: users.filter((u: any) => ["super_admin", "admin", "owner"].includes(u.role)).length, icon: Shield },
          { label: sa.customRoles, value: customRoles.length, icon: Key },
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={sa.searchUsersPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card className="glass-card border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{sa.user}</TableHead>
                <TableHead>{sa.username}</TableHead>
                <TableHead>{sa.role}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{sa.staffId}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{sa.noTenantsFound}</TableCell></TableRow>
              ) : filtered.map((u: any) => (
                <TableRow key={u.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold text-sm ring-1 ring-primary/10">
                        {(u.full_name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{u.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${roleBadgeColor(u.role)}`}>
                      {u.role?.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "default" : "secondary"} className="text-xs">
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.staff_id || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingUser ? <Edit className="h-5 w-5 text-primary" /> : <UserPlus className="h-5 w-5 text-primary" />}
              {editingUser ? sa.editUserTitle : sa.createNewUser}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>{sa.fullName} *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Enter full name" />
            </div>
            <div className="space-y-2">
              <Label>{sa.username} * {editingUser && <span className="text-xs text-muted-foreground">(read-only)</span>}</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editingUser} placeholder="Enter username" className={editingUser ? "bg-muted" : ""} />
            </div>
            <div className="space-y-2">
              <Label>{sa.emailUsername}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Enter email" />
            </div>
            <div className="space-y-2">
              <Label>{sa.mobile}</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="Enter mobile" />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? "New Password" : "Password *"}</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingUser ? "Leave blank to keep" : "Enter password"}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{sa.staffId}</Label>
              <Input value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} placeholder="e.g. S-001" />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v, custom_role_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="custom">Custom Role</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "custom" && (
              <div className="space-y-2">
                <Label>Custom Role</Label>
                <Select value={form.custom_role_id} onValueChange={(v) => setForm({ ...form, custom_role_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {customRoles.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t.common.status}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t.common.description}</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Enter address" rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={() => saveMutation.mutate(!!editingUser)} disabled={saveMutation.isPending} className="bg-gradient-to-r from-primary to-accent">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sa.deleteUser}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The user and their role assignments will be permanently removed.</p>
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
