import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface ModuleItem {
  id: string;
  name: string;
  slug: string;
  is_core: boolean;
}

export default function SuperPlans() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", slug: "", description: "",
    price_monthly: "0", price_yearly: "0",
    max_customers: "100", max_users: "5", max_routers: "2",
    has_accounting: false, has_hr: false, has_inventory: false,
    has_sms: true, has_custom_domain: false,
    modules: [] as string[],
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["super-plans"],
    queryFn: superAdminApi.getPlans,
  });

  const { data: allModules = [] } = useQuery<ModuleItem[]>({
    queryKey: ["super-modules"],
    queryFn: superAdminApi.getModules,
  });

  const nonCoreModules = allModules.filter((m: ModuleItem) => !m.is_core);

  const createMut = useMutation({
    mutationFn: (data: any) => editPlan
      ? superAdminApi.updatePlan(editPlan.id, data)
      : superAdminApi.createPlan(data),
    onSuccess: () => {
      toast.success(editPlan ? "Plan updated" : "Plan created");
      setShowCreate(false);
      setEditPlan(null);
      qc.invalidateQueries({ queryKey: ["super-plans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: superAdminApi.deletePlan,
    onSuccess: () => { toast.success("Plan deleted"); qc.invalidateQueries({ queryKey: ["super-plans"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditPlan(null);
    setForm({
      name: "", slug: "", description: "",
      price_monthly: "0", price_yearly: "0",
      max_customers: "100", max_users: "5", max_routers: "2",
      has_accounting: false, has_hr: false, has_inventory: false,
      has_sms: true, has_custom_domain: false,
      modules: [],
    });
    setShowCreate(true);
  };

  const openEdit = (plan: any) => {
    setEditPlan(plan);
    setForm({
      name: plan.name, slug: plan.slug, description: plan.description || "",
      price_monthly: String(plan.price_monthly || 0),
      price_yearly: String(plan.price_yearly || 0),
      max_customers: String(plan.max_customers || 100),
      max_users: String(plan.max_users || 5),
      max_routers: String(plan.max_routers || 2),
      has_accounting: plan.has_accounting || false,
      has_hr: plan.has_hr || false,
      has_inventory: plan.has_inventory || false,
      has_sms: plan.has_sms !== false,
      has_custom_domain: plan.has_custom_domain || false,
      modules: plan.module_slugs || (plan.modules || []).map((m: any) => m.slug) || [],
    });
    setShowCreate(true);
  };

  const toggleModule = (slug: string) => {
    setForm(prev => ({
      ...prev,
      modules: prev.modules.includes(slug)
        ? prev.modules.filter(s => s !== slug)
        : [...prev.modules, slug],
    }));
  };

  const selectAllModules = () => {
    setForm(prev => ({
      ...prev,
      modules: nonCoreModules.map(m => m.slug),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Plan Management</h1>
        <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) setEditPlan(null); }}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Create Plan</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editPlan ? "Edit Plan" : "Create Subscription Plan"}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="starter" required />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Price (৳)</Label>
                  <Input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Yearly Price (৳)</Label>
                  <Input type="number" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Customers</Label>
                  <Input type="number" value={form.max_customers} onChange={(e) => setForm({ ...form, max_customers: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Users</Label>
                  <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              {/* Feature Toggles */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "has_accounting", label: "Accounting" },
                  { key: "has_hr", label: "HR Module" },
                  { key: "has_inventory", label: "Inventory" },
                  { key: "has_sms", label: "SMS" },
                  { key: "has_custom_domain", label: "Custom Domain" },
                ].map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <Switch checked={(form as any)[f.key]} onCheckedChange={(v) => setForm({ ...form, [f.key]: v })} />
                    <Label className="text-sm">{f.label}</Label>
                  </div>
                ))}
              </div>

              {/* Module Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Allowed Modules</Label>
                  <Button type="button" variant="outline" size="sm" onClick={selectAllModules}>Select All</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Core modules (Dashboard, Customers, Users, Roles, Settings) are always included. Select additional modules for this plan:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {nonCoreModules.map((mod) => (
                    <label key={mod.slug} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={form.modules.includes(mod.slug)}
                        onCheckedChange={() => toggleModule(mod.slug)}
                      />
                      <span className="text-sm">{mod.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editPlan ? "Update Plan" : "Create Plan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Yearly</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : plans.map((p: any) => {
                const moduleSlugs = p.module_slugs || (p.modules || []).map((m: any) => m.slug) || [];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>৳{Number(p.price_monthly).toLocaleString()}</TableCell>
                    <TableCell>৳{Number(p.price_yearly).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      {p.max_customers} customers · {p.max_users} users · {p.max_routers} routers
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {moduleSlugs.length > 0 ? moduleSlugs.map((slug: string) => (
                          <Badge key={slug} variant="secondary" className="text-xs">{slug}</Badge>
                        )) : (
                          <span className="text-xs text-muted-foreground">Core only</span>
                        )}
                        {p.has_accounting && !moduleSlugs.includes('accounting') && <Badge variant="secondary" className="text-xs">Accounting</Badge>}
                        {p.has_hr && !moduleSlugs.includes('hr') && <Badge variant="secondary" className="text-xs">HR</Badge>}
                        {p.has_sms && !moduleSlugs.includes('sms') && <Badge variant="secondary" className="text-xs">SMS</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{p.subscriptions_count || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this plan?")) deleteMut.mutate(p.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
