import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useLanguage } from "@/contexts/LanguageContext";

interface ModuleItem {
  id: string;
  name: string;
  slug: string;
  is_core: boolean;
  sort_order: number;
}

export default function SuperPlans() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", description: "",
    price_monthly: "0", price_yearly: "0",
    max_customers: "100", max_users: "5", max_routers: "2",
    has_accounting: false, has_hr: false, has_inventory: false,
    has_sms: true, has_custom_domain: false,
    modules: [] as string[], // module slugs
  });

  // Fetch plans with their modules
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["super-plans"],
    queryFn: async () => {
      const { data: plansData, error } = await db
        .from("saas_plans")
        .select("*")
        .order("sort_order");
      if (error) throw error;

      // Fetch plan_modules for all plans
      const planIds = (plansData || []).map((p: any) => p.id);
      let planModulesMap: Record<string, string[]> = {};

      if (planIds.length > 0) {
        const { data: pmData } = await db
          .from("plan_modules")
          .select("plan_id, module_id, modules(slug, name)")
          .in("plan_id", planIds);

        (pmData || []).forEach((pm: any) => {
          if (!planModulesMap[pm.plan_id]) planModulesMap[pm.plan_id] = [];
          if (pm.modules?.slug) planModulesMap[pm.plan_id].push(pm.modules.slug);
        });
      }

      return (plansData || []).map((p: any) => ({
        ...p,
        module_slugs: planModulesMap[p.id] || [],
      }));
    },
  });

  // Fetch all modules
  const { data: allModules = [] } = useQuery<ModuleItem[]>({
    queryKey: ["super-modules"],
    queryFn: async () => {
      const { data, error } = await db
        .from("modules")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as ModuleItem[];
    },
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setSaving(true);
    try {
      const planData = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        price_monthly: Number(form.price_monthly) || 0,
        price_yearly: Number(form.price_yearly) || 0,
        max_customers: Number(form.max_customers) || 100,
        max_users: Number(form.max_users) || 5,
        max_routers: Number(form.max_routers) || 2,
        has_accounting: form.has_accounting,
        has_hr: form.has_hr,
        has_inventory: form.has_inventory,
        has_sms: form.has_sms,
        has_custom_domain: form.has_custom_domain,
      };

      let planId: string;

      if (editPlan) {
        const { error } = await db.from("saas_plans").update(planData).eq("id", editPlan.id);
        if (error) throw error;
        planId = editPlan.id;
      } else {
        const { data, error } = await db.from("saas_plans").insert(planData).select("id").single();
        if (error) throw error;
        planId = data.id;
      }

      // Sync plan modules
      await db.from("plan_modules").delete().eq("plan_id", planId);

      // Get module IDs for selected slugs (exclude core — they're always available)
      const selectedSlugs = form.modules;
      if (selectedSlugs.length > 0) {
        const { data: modRows } = await db
          .from("modules")
          .select("id")
          .in("slug", selectedSlugs);

        if (modRows && modRows.length > 0) {
          const inserts = modRows.map((m: any) => ({
            plan_id: planId,
            module_id: m.id,
          }));
          const { error: pmErr } = await db.from("plan_modules").insert(inserts);
          if (pmErr) throw pmErr;
        }
      }

      toast.success(editPlan ? "Plan updated" : "Plan created");
      setShowCreate(false);
      setEditPlan(null);
      qc.invalidateQueries({ queryKey: ["super-plans"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    try {
      const { error } = await db.from("saas_plans").delete().eq("id", id);
      if (error) throw error;
      toast.success("Plan deleted");
      qc.invalidateQueries({ queryKey: ["super-plans"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
      modules: plan.module_slugs || [],
    });
    setShowCreate(true);
  };

  const toggleModule = (slug: string, isCoreModule: boolean) => {
    if (isCoreModule) return; // Core modules can't be toggled
    setForm(prev => ({
      ...prev,
      modules: prev.modules.includes(slug)
        ? prev.modules.filter(s => s !== slug)
        : [...prev.modules, slug],
    }));
  };

  const selectAllModules = () => {
    const nonCoreSlugs = allModules.filter(m => !m.is_core).map(m => m.slug);
    setForm(prev => ({ ...prev, modules: nonCoreSlugs }));
  };

  const deselectAllModules = () => {
    setForm(prev => ({ ...prev, modules: [] }));
  };

  const allNonCoreSelected = allModules
    .filter(m => !m.is_core)
    .every(m => form.modules.includes(m.slug));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{sa.planManagement}</h1>
        <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) setEditPlan(null); }}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> {sa.createPlan}</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editPlan ? sa.editPlan : sa.createSubscriptionPlan}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{sa.planName}</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>{sa.slug}</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="starter" required />
                </div>
                <div className="space-y-2">
                  <Label>{sa.monthlyPrice}</Label>
                  <Input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{sa.yearlyPrice}</Label>
                  <Input type="number" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{sa.maxCustomers}</Label>
                  <Input type="number" value={form.max_customers} onChange={(e) => setForm({ ...form, max_customers: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{sa.maxUsers}</Label>
                  <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.common.description}</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              {/* Module Selection - ALL modules shown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{sa.moduleAccessControl}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={allNonCoreSelected ? deselectAllModules : selectAllModules}
                  >
                    {allNonCoreSelected ? sa.deselectAll : sa.selectAll}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Core modules are always enabled. Toggle additional modules for this plan.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allModules.map((mod) => {
                    const isEnabled = mod.is_core || form.modules.includes(mod.slug);
                    return (
                      <label
                        key={mod.slug}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isEnabled
                            ? "border-primary/30 bg-primary/5"
                            : "border-border hover:bg-accent/50"
                        } ${mod.is_core ? "opacity-80 cursor-default" : ""}`}
                        onClick={(e) => {
                          if (mod.is_core) e.preventDefault();
                        }}
                      >
                        <Switch
                          checked={isEnabled}
                          disabled={mod.is_core}
                          onCheckedChange={() => toggleModule(mod.slug, mod.is_core)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{mod.name}</span>
                          {mod.is_core && (
                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">{sa.core}</Badge>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editPlan ? sa.updatePlan : sa.createPlan}
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
                <TableHead>{sa.limits}</TableHead>
                <TableHead>{sa.modules}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : plans.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{sa.noPlansFound}</TableCell></TableRow>
              ) : plans.map((p: any) => {
                const coreCount = allModules.filter(m => m.is_core).length;
                const totalEnabled = coreCount + (p.module_slugs?.length || 0);
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
                      {p.max_customers} customers · {p.max_users} users
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {totalEnabled}/{allModules.length} modules
                        </Badge>
                        {(p.module_slugs || []).slice(0, 3).map((slug: string) => (
                          <Badge key={slug} variant="outline" className="text-xs">{slug}</Badge>
                        ))}
                        {(p.module_slugs?.length || 0) > 3 && (
                          <Badge variant="outline" className="text-xs">+{p.module_slugs.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
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
