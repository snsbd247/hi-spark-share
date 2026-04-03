import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { runSetupStep, setupAll, resetTenantBusinessData, type SetupResult, type FullSetupResult, type ResetResult } from "@/lib/tenantSetupService";
import TenantInvoicesTab from "@/components/super/TenantInvoicesTab";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Globe, CreditCard, MessageSquare, CheckCircle2,
  AlertTriangle, Loader2, Database, MapPin, BookOpen, Mail, Zap,
  Shield, Activity, Clock, TrendingUp, Lightbulb, Plus, Ban,
  RefreshCw, Trash2, ExternalLink, Phone, AtSign, Calendar,
  LogIn, Users, Eye, Edit, Key, History, Receipt, BarChart3
} from "lucide-react";
import TenantFinancialReportsTab from "@/components/super/TenantFinancialReportsTab";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── SMS Recharge Dialog ─────────────────────────────────────
function SmsRechargeDialog({
  const { t } = useLanguage();
  const sa = t.superAdmin; tenantId, currentBalance, onSuccess }: {
  tenantId: string; currentBalance: number; onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  const recharge = useMutation({
    mutationFn: () => superAdminApi.rechargeSms({
      tenant_id: tenantId, amount: Number(amount),
      description: desc || "Recharge by Super Admin",
    }),
    onSuccess: () => {
      toast.success(`${amount} SMS credits added!`);
      setOpen(false); setAmount(""); setDesc("");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {sa.recharge}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{sa.smsBalanceRecharge}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">{sa.currentBalance}</p>
            <p className="text-2xl font-bold">{currentBalance}</p>
          </div>
          <div className="space-y-2">
            <Label>{sa.amountSmsCredits}</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500" min="1" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[100, 500, 1000, 5000].map((v) => (
              <Button key={v} variant="outline" size="sm" onClick={() => setAmount(String(v))} className={amount === String(v) ? "border-primary bg-primary/5" : ""}>
                {v}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>{sa.noteOptional}</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Recharge description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
          <Button onClick={() => recharge.mutate()} disabled={!amount || Number(amount) < 1 || recharge.isPending}>
            {recharge.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Add {amount || 0} Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Domain Add Dialog ───────────────────────────────────────
function DomainAddDialog({
  const { t } = useLanguage();
  const sa = t.superAdmin; tenantId, onSuccess }: { tenantId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");

  const addDomain = useMutation({
    mutationFn: () => superAdminApi.assignDomain({ tenant_id: tenantId, domain }),
    onSuccess: () => { toast.success("Domain added!"); setOpen(false); setDomain(""); onSuccess(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> {sa.addDomain}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{sa.addCustomDomain}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{sa.domainName}</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="billing.yourisp.com" />
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">{sa.dnsConfiguration}</p>
            <p>Add an A record pointing to: <code className="bg-muted px-1 rounded">185.158.133.1</code></p>
            <p>Or CNAME to: <code className="bg-muted px-1 rounded">smartispapp.com</code></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
          <Button onClick={() => addDomain.mutate()} disabled={!domain || addDomain.isPending}>
            {addDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Add Domain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Subscription Assign Dialog ──────────────────────────────
function SubscriptionDialog({
  const { t } = useLanguage();
  const sa = t.superAdmin; tenantId, currentSub, onSuccess }: {
  tenantId: string; currentSub: any; onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState("monthly");

  const { data: plans = [] } = useQuery({ queryKey: ["super-plans"], queryFn: superAdminApi.getPlans });

  const assign = useMutation({
    mutationFn: () => superAdminApi.assignSubscription({ tenant_id: tenantId, plan_id: planId, billing_cycle: cycle }),
    onSuccess: () => { toast.success("Subscription assigned!"); setOpen(false); onSuccess(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={currentSub ? "outline" : "default"}>
          <CreditCard className="h-4 w-4 mr-1" /> {currentSub ? "Change Plan" : "Assign Plan"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{currentSub ? "Change Subscription" : "Assign Subscription"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {currentSub && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">{sa.currentPlanLabel}</p>
              <p className="font-medium">{currentSub.plan?.name} — {currentSub.billing_cycle}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>{sa.selectPlan}</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder={sa.choosePlan} /></SelectTrigger>
              <SelectContent>
                {plans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — ৳{p.price_monthly}/mo · ৳{p.price_yearly}/yr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{sa.billingCycle}</Label>
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{sa.monthly}</SelectItem>
                <SelectItem value="yearly">{sa.yearly}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
          <Button onClick={() => assign.mutate()} disabled={!planId || assign.isPending}>
            {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Assign Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Impersonate Button ──────────────────────────────────────
function ImpersonateButton({
  const { t } = useLanguage();
  const sa = t.superAdmin; tenantId, tenantName, tenantSubdomain }: { tenantId: string; tenantName: string; tenantSubdomain: string }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleImpersonate = async () => {
    if (!confirm(`Login as "${tenantName}" tenant admin? This will open a new session.`)) return;
    setLoading(true);
    try {
      const result = await superAdminApi.impersonateTenant(tenantId);

      // Save super admin session to restore later
      const superToken = localStorage.getItem("super_admin_token");
      const superUser = localStorage.getItem("super_admin_user");
      if (superToken) localStorage.setItem("saved_super_token", superToken);
      if (superUser) localStorage.setItem("saved_super_user", superUser);

      // Set tenant admin session
      localStorage.setItem("admin_token", result.token);
      localStorage.setItem("admin_user", JSON.stringify(result.user));
      localStorage.setItem("impersonation_token", result.token);
      localStorage.setItem("impersonation_tenant", JSON.stringify(result.tenant));

      toast.success(`Logging in as ${tenantName}...`);

      // Navigate to tenant dashboard
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e.message || "Impersonation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleImpersonate} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      Login as Tenant
    </Button>
  );
}

// ─── Tenant Users Tab ────────────────────────────────────────
function TenantUsersTab({
  const { t } = useLanguage();
  const sa = t.superAdmin; tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [editUser, setEditUser] = useState<any>(null);
  const [editMode, setEditMode] = useState<"info" | "password">("info");
  const [editData, setEditData] = useState<any>({});
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", username: "", password: "", mobile: "", role: "admin", staff_id: "", address: "" });
  const [search, setSearch] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["super-tenant-users", tenantId] });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["super-tenant-users", tenantId],
    queryFn: () => superAdminApi.getTenantUsers(tenantId),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => superAdminApi.updateTenantUser(tenantId, editUser.id, payload),
    onSuccess: () => { toast.success("User updated"); setEditUser(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatusMut = useMutation({
    mutationFn: ({ userId, newStatus }: { userId: string; newStatus: string }) =>
      superAdminApi.updateTenantUser(tenantId, userId, { status: newStatus }),
    onSuccess: (_, { newStatus }) => { toast.success(`User ${newStatus === "active" ? "activated" : "deactivated"}`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () => superAdminApi.createTenantUser(tenantId, newUser),
    onSuccess: () => {
      toast.success("User created successfully!");
      setShowAddUser(false);
      setNewUser({ full_name: "", email: "", username: "", password: "", mobile: "", role: "admin", staff_id: "", address: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditMode("info");
    setEditData({
      full_name: u.full_name || "",
      email: u.email || "",
      username: u.username || "",
      mobile: u.mobile || "",
      staff_id: u.staff_id || "",
      address: u.address || "",
      role: u.role || "staff",
      status: u.status || "active",
    });
  };

  const openPasswordReset = (u: any) => {
    setEditUser(u);
    setEditMode("password");
    setEditData({ password: "" });
  };

  const filtered = users.filter((u: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(s) ||
           (u.email || "").toLowerCase().includes(s) ||
           (u.username || "").toLowerCase().includes(s) ||
           (u.mobile || "").toLowerCase().includes(s);
  });

  const ROLES = [
    { value: "super_admin", label: "Owner (Full Access)" },
    { value: "admin", label: "Admin" },
    { value: "manager", label: "Manager" },
    { value: "staff", label: "Staff" },
    { value: "operator", label: "Operator" },
    { value: "technician", label: "Technician" },
    { value: "accountant", label: "Accountant" },
  ];

  if (isLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Tenant Users ({users.length})</CardTitle>
              <CardDescription>Manage all users for this tenant</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder={sa.searchUsers} value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 h-9" />
              <Button size="sm" onClick={() => setShowAddUser(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground font-medium">{sa.noUsersFound}</p>
              <p className="text-xs text-muted-foreground">Click "Add User" to create the first admin user</p>
              <Button size="sm" onClick={() => setShowAddUser(true)}><Plus className="h-4 w-4 mr-1" /> {sa.createFirstUser}</Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users match "{search}"</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{sa.fullName}</TableHead>
                    <TableHead className="hidden sm:table-cell">Username</TableHead>
                    <TableHead>{sa.emailMobile}</TableHead>
                    <TableHead>{sa.role}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {(u.full_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{u.full_name}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{u.username || "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{u.username || "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{u.email || "—"}</p>
                          {u.mobile && <p className="text-xs text-muted-foreground">{u.mobile}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{u.role || "staff"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === "active" ? "default" : "destructive"}
                          className="text-xs capitalize cursor-pointer"
                          onClick={() => toggleStatusMut.mutate({
                            userId: u.id,
                            newStatus: u.status === "active" ? "disabled" : "active",
                          })}
                        >
                          {u.status || "active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit user" onClick={() => openEdit(u)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset password" onClick={() => openPasswordReset(u)}>
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title={u.status === "active" ? "Deactivate" : "Activate"}
                            onClick={() => toggleStatusMut.mutate({
                              userId: u.id,
                              newStatus: u.status === "active" ? "disabled" : "active",
                            })}
                          >
                            {u.status === "active" ? <Ban className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add User Dialog ── */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{sa.addNewTenantUser}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{sa.fullName} <span className="text-destructive">*</span></Label>
                <Input value={newUser.full_name} onChange={(e) => setNewUser(d => ({ ...d, full_name: e.target.value }))} placeholder="John Doe" />
              </div>
              <div>
                <Label>{sa.username} <span className="text-destructive">*</span></Label>
                <Input value={newUser.username} onChange={(e) => setNewUser(d => ({ ...d, username: e.target.value }))} placeholder="john.doe" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{sa.emailUsername}</Label>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser(d => ({ ...d, email: e.target.value }))} placeholder="user@example.com" />
              </div>
              <div>
                <Label>{sa.mobile}</Label>
                <Input value={newUser.mobile} onChange={(e) => setNewUser(d => ({ ...d, mobile: e.target.value }))} placeholder="01XXXXXXXXX" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{sa.password} <span className="text-destructive">*</span></Label>
                <Input type="password" value={newUser.password} onChange={(e) => setNewUser(d => ({ ...d, password: e.target.value }))} placeholder="Min 6 characters" />
              </div>
              <div>
                <Label>{sa.role} <span className="text-destructive">*</span></Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser(d => ({ ...d, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{sa.staffId}</Label>
                <Input value={newUser.staff_id} onChange={(e) => setNewUser(d => ({ ...d, staff_id: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <Label>{t.common.description}</Label>
                <Input value={newUser.address} onChange={(e) => setNewUser(d => ({ ...d, address: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
              <p>📧 Login credentials will be sent via email if configured</p>
              <p>🔒 User will be required to change password on first login</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>{t.common.cancel}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!newUser.full_name || !newUser.username || !newUser.password || newUser.password.length < 6 || createMut.isPending}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit / Reset Password Dialog ── */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode === "password" ? <Key className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
              {editMode === "password" ? "Reset Password" : "Edit User"}: {editUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          {editMode === "password" ? (
            <div className="space-y-3">
              <div>
                <Label>{sa.newPassword}</Label>
                <Input type="password" value={editData.password || ""} onChange={(e) => setEditData({ password: e.target.value })} placeholder="Enter new password (min 6 chars)" />
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                🔒 User will be forced to change password on next login
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Full Name</Label>
                  <Input value={editData.full_name || ""} onChange={(e) => setEditData((d: any) => ({ ...d, full_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input value={editData.username || ""} onChange={(e) => setEditData((d: any) => ({ ...d, username: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{sa.emailUsername}</Label>
                  <Input value={editData.email || ""} onChange={(e) => setEditData((d: any) => ({ ...d, email: e.target.value }))} />
                </div>
                <div>
                  <Label>{sa.mobile}</Label>
                  <Input value={editData.mobile || ""} onChange={(e) => setEditData((d: any) => ({ ...d, mobile: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{sa.staffId}</Label>
                  <Input value={editData.staff_id || ""} onChange={(e) => setEditData((d: any) => ({ ...d, staff_id: e.target.value }))} />
                </div>
                <div>
                  <Label>{sa.role}</Label>
                  <Select value={editData.role || "staff"} onValueChange={(v) => setEditData((d: any) => ({ ...d, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t.common.description}</Label>
                <Input value={editData.address || ""} onChange={(e) => setEditData((d: any) => ({ ...d, address: e.target.value }))} />
              </div>
              <div>
                <Label>{t.common.status}</Label>
                <Select value={editData.status || "active"} onValueChange={(v) => setEditData((d: any) => ({ ...d, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>{t.common.cancel}</Button>
            <Button
              onClick={() => {
                const payload = editMode === "password"
                  ? { password: editData.password, must_change_password: true }
                  : editData;
                updateMut.mutate(payload);
              }}
              disabled={updateMut.isPending || (editMode === "password" && (!editData.password || editData.password.length < 6))}
            >
              {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editMode === "password" ? "Reset Password" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Tenant Activity Logs Tab ────────────────────────────────
function TenantActivityTab({
  const { t } = useLanguage();
  const sa = t.superAdmin; tenantId }: { tenantId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["super-tenant-activity", tenantId],
    queryFn: () => superAdminApi.getTenantActivityLogs(tenantId),
  });

  if (isLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;

  const actionColors: Record<string, string> = {
    create: "default",
    edit: "secondary",
    delete: "destructive",
    login: "default",
    impersonate: "outline",
    payment: "default",
    settings: "secondary",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5" /> {sa.activityLogs}</CardTitle>
        <CardDescription>Recent user actions in this tenant</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{sa.noActivityLogs}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sa.time}</TableHead>
                <TableHead>{sa.user}</TableHead>
                <TableHead>{sa.action}</TableHead>
                <TableHead>{sa.module}</TableHead>
                <TableHead>{t.common.description}</TableHead>
                <TableHead>{sa.ip}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.slice(0, 100).map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{log.user?.full_name || log.user_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={(actionColors[log.action] as any) || "secondary"} className="text-xs capitalize">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{log.module}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{log.description}</TableCell>
                  <TableCell className="text-xs font-mono">{log.ip_address || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tenant Login History Tab ────────────────────────────────
function TenantLoginHistoryTab({
  const { t } = useLanguage();
  const sa = t.superAdmin; tenantId }: { tenantId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["super-tenant-login-history", tenantId],
    queryFn: () => superAdminApi.getTenantLoginHistory(tenantId),
  });

  if (isLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" /> {sa.loginHistory}</CardTitle>
        <CardDescription>All login attempts for this tenant</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{sa.noLoginHistory}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sa.time}</TableHead>
                <TableHead>{sa.user}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{sa.device}</TableHead>
                <TableHead>{sa.browser}</TableHead>
                <TableHead>{sa.ip}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.slice(0, 100).map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{log.user?.full_name || log.user_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs capitalize">{log.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.device || "—"}</TableCell>
                  <TableCell className="text-sm">{log.browser || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{log.ip_address || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tenant Sessions Tab ─────────────────────────────────────
function TenantSessionsTab({
  const { t } = useLanguage();
  const sa = t.superAdmin; tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["super-tenant-sessions", tenantId],
    queryFn: () => superAdminApi.getTenantSessions(tenantId),
  });

  const terminateMut = useMutation({
    mutationFn: (sessionId: string) => superAdminApi.forceTerminateSession(sessionId),
    onSuccess: () => {
      toast.success("Session terminated");
      qc.invalidateQueries({ queryKey: ["super-tenant-sessions", tenantId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;

  const activeSessions = sessions.filter((s: any) => s.status === "active");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> {sa.activeSessions}</CardTitle>
            <CardDescription>{activeSessions.length} active session(s)</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{sa.noSessions}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sa.user}</TableHead>
                <TableHead>{sa.device}</TableHead>
                <TableHead>{sa.browser}</TableHead>
                <TableHead>{sa.ip}</TableHead>
                <TableHead>{t.common.description}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead>{sa.lastActive}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.slice(0, 50).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-sm">{s.full_name || s.admin_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell className="text-sm">{s.device_name || "—"}</TableCell>
                  <TableCell className="text-sm">{s.browser || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{s.ip_address}</TableCell>
                  <TableCell className="text-sm">
                    {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-xs capitalize">{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(s.updated_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => terminateMut.mutate(s.id)}
                        disabled={terminateMut.isPending}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" /> End
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuperTenantProfile() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [setupRunning, setSetupRunning] = useState<string | null>(null);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["super-tenant", id],
    queryFn: async () => {
      const tenants = await superAdminApi.getTenants({});
      return tenants.find((t: any) => t.id === id);
    },
    enabled: !!id,
  });

  const { data: subscription } = useQuery({
    queryKey: ["super-tenant-sub", id],
    queryFn: async () => {
      const subs = await superAdminApi.getSubscriptions({});
      return subs.find((s: any) => s.tenant_id === id);
    },
    enabled: !!id,
  });

  const { data: domains = [] } = useQuery({
    queryKey: ["super-tenant-domains", id],
    queryFn: async () => {
      const all = await superAdminApi.getDomains();
      return all.filter((d: any) => d.tenant_id === id);
    },
    enabled: !!id,
  });

  const { data: wallet } = useQuery({
    queryKey: ["super-tenant-wallet", id],
    queryFn: async () => {
      const wallets = await superAdminApi.getSmsWallets();
      return wallets.find((w: any) => w.tenant_id === id);
    },
    enabled: !!id,
  });

  const { data: smsTransactions = [] } = useQuery({
    queryKey: ["super-tenant-sms-tx", id],
    queryFn: () => superAdminApi.getSmsTransactions({ tenant_id: id! }),
    enabled: !!id,
  });

  const [forceReimport, setForceReimport] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const setupMut = useMutation({
    mutationFn: async (step: string) => {
      setSetupRunning(step);
      if (step === "all") {
        const result: FullSetupResult = await setupAll(forceReimport);
        if (!result.overall) {
        const failures = [
            !result.geo.success && `Geo: ${result.geo.message}`,
            !result.accounts.success && `Accounts: ${result.accounts.message}`,
            !result.templates.success && `Templates: ${result.templates.message}`,
            !result.ledger.success && `Ledger: ${result.ledger.message}`,
            !result.paymentGateways.success && `Payment Gateways: ${result.paymentGateways.message}`,
          ].filter(Boolean);
          throw new Error(failures.join("; "));
        }
        await superAdminApi.updateTenant(id!, {
          setup_geo: true, setup_accounts: true,
          setup_templates: true, setup_ledger: true,
          setup_payment_gateways: true,
          setup_status: "completed",
        });
        return result;
      } else {
        const result: SetupResult = await runSetupStep(step, forceReimport);
        if (!result.success) throw new Error(result.message);
        await superAdminApi.updateTenant(id!, { [`setup_${step}`]: true });
        return result;
      }
    },
    onSuccess: (result: any, step) => {
      const skippedNote = result?.skipped ? " (data already existed)" : "";
      const msg = step === "all"
        ? "Full setup completed successfully!" + skippedNote
        : `${step} setup completed${result?.count ? ` (${result.count} records)` : ""}!` + skippedNote;
      toast.success(msg);
      setSetupRunning(null);
      qc.invalidateQueries({ queryKey: ["super-tenant", id] });
    },
    onError: (e: any) => { toast.error(e.message || "Setup failed"); setSetupRunning(null); },
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      const result: ResetResult = await resetTenantBusinessData();
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: (result: ResetResult) => {
      toast.success(`Reset complete! ${result.tables_cleared.length} tables cleared.`);
      setShowResetConfirm(false);
      setResetConfirmText("");
      qc.invalidateQueries({ queryKey: ["super-tenant", id] });
    },
    onError: (e: any) => {
      toast.error(e.message || "Reset failed");
    },
  });


  const suspendMut = useMutation({
    mutationFn: () => superAdminApi.suspendTenant(id!),
    onSuccess: () => { toast.success("Tenant suspended"); invalidateAll(); },
  });

  const activateMut = useMutation({
    mutationFn: () => superAdminApi.activateTenant(id!),
    onSuccess: () => { toast.success("Tenant activated"); invalidateAll(); },
  });

  const removeDomainMut = useMutation({
    mutationFn: (domainId: string) => superAdminApi.removeDomain(domainId),
    onSuccess: () => { toast.success("Domain removed"); qc.invalidateQueries({ queryKey: ["super-tenant-domains", id] }); },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["super-tenant", id] });
    qc.invalidateQueries({ queryKey: ["super-tenant-sub", id] });
    qc.invalidateQueries({ queryKey: ["super-tenant-domains", id] });
    qc.invalidateQueries({ queryKey: ["super-tenant-wallet", id] });
    qc.invalidateQueries({ queryKey: ["super-tenant-sms-tx", id] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-36" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">{sa.tenantNotFound}</p>
        <Button variant="link" onClick={() => navigate("/super/tenants")}>{sa.backToTenants}</Button>
      </div>
    );
  }

  const setupSteps = [
    { key: "geo", label: "Geo Data (Division/District/Upazila)", icon: MapPin, done: tenant.setup_geo },
    { key: "accounts", label: "Chart of Accounts", icon: BookOpen, done: tenant.setup_accounts },
    { key: "templates", label: "SMS/Email Templates", icon: Mail, done: tenant.setup_templates },
    { key: "ledger", label: "Ledger Mapping Settings", icon: Database, done: tenant.setup_ledger },
    { key: "payment_gateways", label: "Payment Gateways (bKash & Nagad)", icon: CreditCard, done: tenant.setup_payment_gateways },
  ];
  const completedSteps = setupSteps.filter((s) => s.done).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;
  const isFullySetup = tenant.setup_status === "completed" || completedSteps === setupSteps.length;

  // Smart Alerts
  const alerts: { type: "warning" | "error" | "info"; message: string; action?: () => void }[] = [];
  if (tenant.status === "suspended") alerts.push({ type: "error", message: "Tenant is currently suspended — users cannot login", action: () => activateMut.mutate() });
  if (!isFullySetup) alerts.push({ type: "warning", message: `Setup incomplete (${completedSteps}/${setupSteps.length}) — some features may not work` });
  if (!subscription) alerts.push({ type: "error", message: "No active subscription — billing features disabled" });
  else if (subscription.end_date && new Date(subscription.end_date) < new Date(Date.now() + 7 * 86400000)) {
    alerts.push({ type: "warning", message: `Subscription expires on ${subscription.end_date}` });
  }
  if ((wallet?.balance || 0) < 50) alerts.push({ type: "warning", message: `SMS balance critically low (${wallet?.balance || 0} credits remaining)` });
  if (domains.length === 0) alerts.push({ type: "info", message: "No custom domain configured — tenant uses subdomain only" });

  // AI Suggestions
  const suggestions: string[] = [];
  if (!isFullySetup) suggestions.push("Run 'One-Click Full Setup' to import all initial data at once");
  if (!subscription) suggestions.push("Assign a subscription plan to enable tenant billing");
  if ((wallet?.balance || 0) < 100) suggestions.push("Recharge SMS balance to ensure uninterrupted messaging");
  if (subscription?.plan?.slug === "basic") suggestions.push("Consider upgrading to Professional plan for Accounting & HR modules");

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/super/tenants")} className="shrink-0 self-start">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 truncate">
            <Building2 className="h-6 w-6 shrink-0" /> {tenant.name}
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" /> {tenant.subdomain}.smartispapp.com
          </p>
        </div>
        <div className="flex items-center gap-2 self-start flex-wrap">
          <Badge variant={tenant.status === "active" ? "default" : "destructive"} className="text-sm px-3 py-1 capitalize">
            {tenant.status}
          </Badge>
          <ImpersonateButton tenantId={id!} tenantName={tenant.name} tenantSubdomain={tenant.subdomain} />
          {tenant.status === "active" ? (
            <Button variant="outline" size="sm" onClick={() => { if (confirm("Suspend this tenant?")) suspendMut.mutate(); }}>
              <Ban className="h-4 w-4 mr-1" /> Suspend
            </Button>
          ) : (
            <Button size="sm" onClick={() => activateMut.mutate()}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Activate
            </Button>
          )}
        </div>
      </div>

      {/* ── Smart Alerts ───────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              a.type === "error" ? "bg-destructive/10 text-destructive" :
              a.type === "warning" ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" :
              "bg-primary/10 text-primary"
            }`}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{a.message}</span>
              {a.action && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={a.action}>
                  Fix
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Overview Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> Tenant Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{tenant.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{tenant.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{new Date(tenant.created_at).toLocaleDateString("en-GB")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Domain Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-4 w-4" /> Domains
              </CardTitle>
              <DomainAddDialog tenantId={id!} onSuccess={() => qc.invalidateQueries({ queryKey: ["super-tenant-domains", id] })} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">default</Badge>
              <span className="truncate text-muted-foreground">{tenant.subdomain}.smartisp...</span>
            </div>
            {domains.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-2 truncate">
                  {d.is_verified ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{d.domain}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeDomainMut.mutate(d.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" /> Subscription
              </CardTitle>
              <SubscriptionDialog tenantId={id!} currentSub={subscription} onSuccess={() => qc.invalidateQueries({ queryKey: ["super-tenant-sub", id] })} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {subscription ? (
              <>
                <p className="font-semibold text-base text-foreground">{subscription.plan?.name || "—"}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{subscription.billing_cycle}</Badge>
                  <Badge variant={subscription.status === "active" ? "default" : "destructive"} className="text-xs">{subscription.status}</Badge>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">Tk {Number(subscription.amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-semibold">{subscription.end_date || "—"}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-2">No subscription assigned</p>
            )}
          </CardContent>
        </Card>

        {/* SMS Balance Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" /> SMS Balance
              </CardTitle>
              <SmsRechargeDialog
                tenantId={id!}
                currentBalance={wallet?.balance || 0}
                onSuccess={() => {
                  qc.invalidateQueries({ queryKey: ["super-tenant-wallet", id] });
                  qc.invalidateQueries({ queryKey: ["super-tenant-sms-tx", id] });
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${(wallet?.balance || 0) > 50 ? "text-primary" : "text-destructive"}`}>
              {(wallet?.balance || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">SMS credits remaining</p>
            {(wallet?.balance || 0) < 50 && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Low balance warning
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}

      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="w-full grid grid-cols-7">
          <TabsTrigger value="reports"><BarChart3 className="h-4 w-4 mr-1" /> Reports</TabsTrigger>
          <TabsTrigger value="sms"><RefreshCw className="h-4 w-4 mr-1" /> SMS</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Users</TabsTrigger>
          <TabsTrigger value="invoices"><Receipt className="h-4 w-4 mr-1" /> Invoices</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
          <TabsTrigger value="logins"><History className="h-4 w-4 mr-1" /> Logins</TabsTrigger>
          <TabsTrigger value="sessions"><Shield className="h-4 w-4 mr-1" /> Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <TenantFinancialReportsTab tenantId={id!} />
        </TabsContent>

        <TabsContent value="sms">
          {smsTransactions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SMS Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>{t.common.description}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smsTransactions.slice(0, 10).map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{new Date(tx.created_at).toLocaleDateString("en-GB")}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === "credit" ? "default" : "secondary"} className="text-xs capitalize">{tx.type}</Badge>
                        </TableCell>
                        <TableCell className={`font-medium ${tx.type === "credit" ? "text-primary" : "text-destructive"}`}>
                          {tx.type === "credit" ? "+" : "−"}{tx.amount}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.description || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No SMS transactions yet</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="users">
          <TenantUsersTab tenantId={id!} />
        </TabsContent>

        <TabsContent value="invoices">
          <TenantInvoicesTab tenantId={id!} tenantName={tenant.name} />
        </TabsContent>

        <TabsContent value="activity">
          <TenantActivityTab tenantId={id!} />
        </TabsContent>

        <TabsContent value="logins">
          <TenantLoginHistoryTab tenantId={id!} />
        </TabsContent>

        <TabsContent value="sessions">
          <TenantSessionsTab tenantId={id!} />
        </TabsContent>
      </Tabs>

      {/* ── AI Suggestions ─────────────────────────────────── */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-yellow-500" /> Smart Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 bg-yellow-500/5 rounded-lg text-sm">
                  <TrendingUp className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Health Status Dashboard ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" /> Health Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50 space-y-1">
              <div className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center ${
                isFullySetup ? "bg-primary/10" : "bg-yellow-500/10"
              }`}>
                {isFullySetup ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-yellow-600" />}
              </div>
              <p className="text-sm font-medium">{isFullySetup ? "Complete" : "Pending"}</p>
              <p className="text-xs text-muted-foreground">Setup</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50 space-y-1">
              <div className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center ${
                subscription?.status === "active" ? "bg-primary/10" : "bg-destructive/10"
              }`}>
                <CreditCard className={`h-5 w-5 ${subscription?.status === "active" ? "text-primary" : "text-destructive"}`} />
              </div>
              <p className="text-sm font-medium">{subscription?.status === "active" ? "Active" : "Inactive"}</p>
              <p className="text-xs text-muted-foreground">Subscription</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50 space-y-1">
              <div className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center ${
                (wallet?.balance || 0) > 50 ? "bg-primary/10" : "bg-yellow-500/10"
              }`}>
                <MessageSquare className={`h-5 w-5 ${(wallet?.balance || 0) > 50 ? "text-primary" : "text-yellow-600"}`} />
              </div>
              <p className="text-sm font-medium">{wallet?.balance || 0}</p>
              <p className="text-xs text-muted-foreground">SMS Credits</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50 space-y-1">
              <div className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center ${
                tenant.status === "active" ? "bg-primary/10" : "bg-destructive/10"
              }`}>
                <Activity className={`h-5 w-5 ${tenant.status === "active" ? "text-primary" : "text-destructive"}`} />
              </div>
              <p className="text-sm font-medium capitalize">{tenant.status}</p>
              <p className="text-xs text-muted-foreground">Activity</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Setup Progress ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> System Setup
              </CardTitle>
              <CardDescription className="mt-1">
                {isFullySetup ? "All setup steps completed" : `${completedSteps} of ${setupSteps.length} steps completed`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceReimport}
                  onChange={(e) => setForceReimport(e.target.checked)}
                  className="rounded border-input"
                />
                Force Re-import
              </label>
              {!isFullySetup || forceReimport ? (
                <Button onClick={() => setupMut.mutate("all")} disabled={setupMut.isPending} size="sm">
                  {setupRunning === "all" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  {forceReimport ? "Re-Import All" : "One-Click Full Setup"}
                </Button>
              ) : (
                <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Setup Complete
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(setupProgress)}%</span>
            </div>
            <Progress value={setupProgress} className="h-2.5" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {setupSteps.map((step) => (
              <div key={step.key} className={`flex items-center justify-between p-3.5 rounded-lg border transition-colors ${
                step.done ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-muted/50"
              }`}>
                <div className="flex items-center gap-2.5">
                  {step.done ? (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <step.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className={`text-sm ${step.done ? "text-primary font-medium" : "text-foreground"}`}>{step.label}</span>
                </div>
                {!step.done || forceReimport ? (
                  <Button variant="outline" size="sm" onClick={() => setupMut.mutate(step.key)} disabled={setupMut.isPending} className="h-8">
                    {setupRunning === step.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (forceReimport && step.done ? "Re-Import" : "Import")}
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-primary border-primary/30">Done</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Reset Business Data ────────────────────────────── */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Reset Business Data
          </CardTitle>
          <CardDescription>
            Delete all business data (customers, bills, payments, transactions) while keeping users, roles, settings, and system configuration intact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 space-y-1 text-sm text-muted-foreground">
              <p>This will permanently delete:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
                <li>Customers, Bills, Payments, Ledger entries</li>
                <li>SMS/Reminder logs, Daily reports</li>
                <li>Products, Expenses, Suppliers</li>
                <li>Transactions</li>
              </ul>
              <p className="text-xs mt-2">Will NOT delete: Users, Roles, Settings, Accounts (COA), Templates, Geo data</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowResetConfirm(true)} className="shrink-0">
              <Trash2 className="h-4 w-4 mr-1" /> Reset Tenant Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={(o) => { if (!o) { setShowResetConfirm(false); setResetConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Confirm Data Reset
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm space-y-2">
              <p className="font-semibold">This action is irreversible!</p>
              <p>All business data for tenant "{tenant?.name}" will be permanently deleted.</p>
            </div>
            <div className="space-y-2">
              <Label>Type <span className="font-mono font-bold">RESET</span> to confirm</Label>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Type RESET here"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetConfirm(false); setResetConfirmText(""); }}>{t.common.cancel}</Button>
            <Button
              variant="destructive"
              onClick={() => resetMut.mutate()}
              disabled={resetConfirmText !== "RESET" || resetMut.isPending}
            >
              {resetMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
