import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building2, Ban, CheckCircle, Trash2, Search, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

export default function SuperTenants() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", subdomain: "", email: "", phone: "",
    admin_name: "", admin_email: "", admin_password: "", plan_id: "",
  });

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["super-tenants", search, statusFilter],
    queryFn: () => superAdminApi.getTenants({
      ...(search && { search }),
      ...(statusFilter !== "all" && { status: statusFilter }),
    }),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["super-plans"],
    queryFn: superAdminApi.getPlans,
  });

  const createMut = useMutation({
    mutationFn: superAdminApi.createTenant,
    onSuccess: () => { toast.success("Tenant created"); setShowCreate(false); qc.invalidateQueries({ queryKey: ["super-tenants"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const suspendMut = useMutation({
    mutationFn: superAdminApi.suspendTenant,
    onSuccess: () => { toast.success("Tenant suspended"); qc.invalidateQueries({ queryKey: ["super-tenants"] }); },
  });

  const activateMut = useMutation({
    mutationFn: superAdminApi.activateTenant,
    onSuccess: () => { toast.success("Tenant activated"); qc.invalidateQueries({ queryKey: ["super-tenants"] }); },
  });

  const deleteMut = useMutation({
    mutationFn: superAdminApi.deleteTenant,
    onSuccess: () => { toast.success("Tenant deleted"); qc.invalidateQueries({ queryKey: ["super-tenants"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Tenant Management</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Tenant</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create New ISP Tenant</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ISP Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Subdomain</Label>
                  <Input value={form.subdomain} onChange={(e) => setForm({ ...form, subdomain: e.target.value })} placeholder="isp1" required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-medium text-muted-foreground">Tenant Admin Account</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Admin Name</Label>
                    <Input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Admin Email</Label>
                    <Input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Admin Password</Label>
                  <Input type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required minLength={6} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Tenant
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tenants..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ISP Name</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : tenants.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tenants found</TableCell></TableRow>
              ) : tenants.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.subdomain}</TableCell>
                  <TableCell>{t.active_subscription?.plan?.name || t.plan || "—"}</TableCell>
                  <TableCell>{t.customer_count || 0}</TableCell>
                  <TableCell>{t.user_count || 0}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "default" : t.status === "trial" ? "secondary" : "destructive"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/super/tenants/${t.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {t.status === "active" ? (
                      <Button variant="ghost" size="sm" onClick={() => suspendMut.mutate(t.id)}>
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => activateMut.mutate(t.id)}>
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this tenant?")) deleteMut.mutate(t.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
