import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus, Loader2, CreditCard, AlertTriangle, CheckCircle, Clock,
  ArrowUpCircle, ArrowDownCircle, Receipt, DollarSign, Calendar,
  TrendingUp, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SuperBilling() {
  const qc = useQueryClient();
  const [showInvoice, setShowInvoice] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [invoiceForm, setInvoiceForm] = useState({ tenant_id: "", plan_id: "", billing_cycle: "monthly", notes: "" });

  // Queries
  const { data: tenants = [] } = useQuery({
    queryKey: ["billing-tenants"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("tenants").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("saas_plans").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["subscription-invoices"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("subscription_invoices").select("*").order("created_at", { ascending: false });
      const tenantsData = await (supabase.from as any)("tenants").select("id, name, subdomain");
      const plansData = await (supabase.from as any)("saas_plans").select("id, name");
      return (data || []).map((inv: any) => ({
        ...inv,
        tenant: tenantsData.data?.find((t: any) => t.id === inv.tenant_id),
        plan: plansData.data?.find((p: any) => p.id === inv.plan_id),
      }));
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["billing-subs"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("subscriptions").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Expiring tenants (within 5 days)
  const expiringTenants = tenants.filter((t: any) => {
    if (!t.plan_expire_date) return false;
    const days = Math.ceil((new Date(t.plan_expire_date).getTime() - Date.now()) / 86400000);
    return days >= -10 && days <= 5;
  }).map((t: any) => ({
    ...t,
    days_left: Math.ceil((new Date(t.plan_expire_date).getTime() - Date.now()) / 86400000),
  }));

  // Stats
  const totalRevenue = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
  const pendingAmount = invoices.filter((i: any) => i.status === "pending").reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
  const activeSubCount = subscriptions.filter((s: any) => s.status === "active").length;

  // Generate invoice mutation
  const generateInvoice = useMutation({
    mutationFn: async (form: any) => {
      const plan = plans.find((p: any) => p.id === form.plan_id);
      if (!plan) throw new Error("Plan not found");
      const amount = form.billing_cycle === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
      const taxRate = 0; // Can configure VAT later
      const taxAmount = amount * taxRate / 100;
      const totalAmount = amount + taxAmount;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const { error } = await (supabase.from as any)("subscription_invoices").insert({
        tenant_id: form.tenant_id,
        plan_id: form.plan_id,
        amount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        billing_cycle: form.billing_cycle,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice generated");
      setShowInvoice(false);
      qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Mark invoice as paid
  const markPaid = useMutation({
    mutationFn: async (invoiceId: string) => {
      const invoice = invoices.find((i: any) => i.id === invoiceId);
      if (!invoice) throw new Error("Invoice not found");

      // Mark paid
      await (supabase.from as any)("subscription_invoices").update({
        status: "paid",
        paid_date: new Date().toISOString(),
        payment_method: "manual",
      }).eq("id", invoiceId);

      // Extend tenant plan
      const newExpiry = new Date();
      if (invoice.billing_cycle === "yearly") {
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      } else {
        newExpiry.setMonth(newExpiry.getMonth() + 1);
      }

      await (supabase.from as any)("tenants").update({
        plan_expire_date: newExpiry.toISOString().split("T")[0],
        plan_id: invoice.plan_id,
        status: "active",
      }).eq("id", invoice.tenant_id);

      // Update subscription
      await (supabase.from as any)("subscriptions").update({ status: "active" })
        .eq("tenant_id", invoice.tenant_id).eq("status", "expired");
    },
    onSuccess: () => {
      toast.success("Invoice marked as paid, plan extended!");
      qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
      qc.invalidateQueries({ queryKey: ["billing-tenants"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Upgrade/downgrade tenant
  const upgradeTenant = useMutation({
    mutationFn: async ({ tenantId, newPlanId, billing_cycle }: { tenantId: string; newPlanId: string; billing_cycle: string }) => {
      const tenant = tenants.find((t: any) => t.id === tenantId);
      const newPlan = plans.find((p: any) => p.id === newPlanId);
      const oldPlan = plans.find((p: any) => p.id === tenant?.plan_id);

      // Calculate proration credit
      let prorationCredit = 0;
      if (tenant?.plan_expire_date && oldPlan) {
        const remainingDays = Math.max(0, Math.ceil((new Date(tenant.plan_expire_date).getTime() - Date.now()) / 86400000));
        const dailyRate = Number(oldPlan.price_monthly) / 30;
        prorationCredit = Math.round(remainingDays * dailyRate * 100) / 100;
      }

      const newAmount = billing_cycle === "yearly" ? Number(newPlan?.price_yearly) : Number(newPlan?.price_monthly);
      const finalAmount = Math.max(0, newAmount - prorationCredit);

      // Generate prorated invoice
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      await (supabase.from as any)("subscription_invoices").insert({
        tenant_id: tenantId,
        plan_id: newPlanId,
        amount: newAmount,
        proration_credit: prorationCredit,
        total_amount: finalAmount,
        billing_cycle,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
        notes: `Plan change: ${oldPlan?.name || "None"} → ${newPlan?.name}. Proration credit: ৳${prorationCredit}`,
      });

      // Update tenant plan immediately
      await (supabase.from as any)("tenants").update({ plan_id: newPlanId }).eq("id", tenantId);
    },
    onSuccess: () => {
      toast.success("Plan changed, prorated invoice created!");
      setShowUpgrade(false);
      setSelectedTenant(null);
      qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
      qc.invalidateQueries({ queryKey: ["billing-tenants"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Run plan check
  const runPlanCheck = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("plan-check");
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Checked ${data.checked} tenants. Suspended: ${data.suspended}, Warned: ${data.warned}`);
      qc.invalidateQueries({ queryKey: ["billing-tenants"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusBadge = (s: string) => {
    if (s === "paid") return <Badge className="bg-emerald-500/10 text-emerald-600"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
    if (s === "pending") return <Badge variant="outline" className="text-amber-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    return <Badge variant="destructive">{s}</Badge>;
  };

  const [upgradeForm, setUpgradeForm] = useState({ plan_id: "", billing_cycle: "monthly" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SaaS Billing & Subscriptions</h1>
          <p className="text-muted-foreground">Manage invoices, plan changes, and payment tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runPlanCheck.mutate()} disabled={runPlanCheck.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${runPlanCheck.isPending ? "animate-spin" : ""}`} /> Run Expiry Check
          </Button>
          <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Generate Invoice</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate Subscription Invoice</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); generateInvoice.mutate(invoiceForm); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tenant</Label>
                  <Select value={invoiceForm.tenant_id} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, tenant_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                    <SelectContent>{tenants.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={invoiceForm.plan_id} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, plan_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select value={invoiceForm.billing_cycle} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={generateInvoice.isPending}>
                  {generateInvoice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Generate Invoice
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Expiry Warnings */}
      {expiringTenants.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Plan Expiry Alerts</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {expiringTenants.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span><strong>{t.name}</strong> — {t.days_left > 0 ? `${t.days_left} দিন বাকি` : `${Math.abs(t.days_left)} দিন আগে expired`}</span>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedTenant(t); setShowUpgrade(true); }}>
                    Extend/Upgrade
                  </Button>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-emerald-500" />
            <div><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">৳{totalRevenue.toLocaleString()}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold">৳{pendingAmount.toLocaleString()}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">Active Subs</p><p className="text-2xl font-bold">{activeSubCount}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div><p className="text-sm text-muted-foreground">Expiring Soon</p><p className="text-2xl font-bold">{expiringTenants.filter((t: any) => t.days_left >= 0).length}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices"><Receipt className="h-4 w-4 mr-1" />Invoices</TabsTrigger>
          <TabsTrigger value="tenants"><TrendingUp className="h-4 w-4 mr-1" />Tenant Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader><CardTitle>Subscription Invoices</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Proration</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInvoices ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No invoices yet</TableCell></TableRow>
                  ) : invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.tenant?.name || "—"}</TableCell>
                      <TableCell>{inv.plan?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{inv.billing_cycle}</Badge></TableCell>
                      <TableCell>৳{Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell>{Number(inv.proration_credit) > 0 ? <span className="text-emerald-600">-৳{Number(inv.proration_credit).toLocaleString()}</span> : "—"}</TableCell>
                      <TableCell className="font-semibold">৳{Number(inv.total_amount).toLocaleString()}</TableCell>
                      <TableCell>{inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell>
                        {inv.status === "pending" && (
                          <Button size="sm" onClick={() => markPaid.mutate(inv.id)} disabled={markPaid.isPending}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants">
          <Card>
            <CardHeader><CardTitle>Tenant Plan Overview</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Current Plan</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Grace Days</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t: any) => {
                    const plan = plans.find((p: any) => p.id === t.plan_id);
                    const daysLeft = t.plan_expire_date ? Math.ceil((new Date(t.plan_expire_date).getTime() - Date.now()) / 86400000) : null;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}<br/><span className="text-xs text-muted-foreground">{t.subdomain}</span></TableCell>
                        <TableCell>{plan?.name || t.plan || "—"}</TableCell>
                        <TableCell>{t.plan_expire_date ? format(new Date(t.plan_expire_date), "dd MMM yyyy") : "Not set"}</TableCell>
                        <TableCell>{t.grace_days ?? 3}</TableCell>
                        <TableCell>
                          {daysLeft !== null ? (
                            <Badge variant={daysLeft < 0 ? "destructive" : daysLeft <= 2 ? "outline" : "default"}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell><Badge variant={t.status === "active" ? "default" : "destructive"}>{t.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => { setSelectedTenant(t); setUpgradeForm({ plan_id: t.plan_id || "", billing_cycle: "monthly" }); setShowUpgrade(true); }}>
                              <ArrowUpCircle className="h-3 w-3 mr-1" />Change Plan
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
        </TabsContent>
      </Tabs>

      {/* Upgrade/Downgrade Dialog */}
      <Dialog open={showUpgrade} onOpenChange={(open) => { setShowUpgrade(open); if (!open) setSelectedTenant(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan — {selectedTenant?.name}</DialogTitle>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p>Current: <strong>{plans.find((p: any) => p.id === selectedTenant.plan_id)?.name || "None"}</strong></p>
                <p>Expires: <strong>{selectedTenant.plan_expire_date || "Not set"}</strong></p>
              </div>
              <div className="space-y-2">
                <Label>New Plan</Label>
                <Select value={upgradeForm.plan_id} onValueChange={(v) => setUpgradeForm({ ...upgradeForm, plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo | ৳{p.price_yearly}/yr</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select value={upgradeForm.billing_cycle} onValueChange={(v) => setUpgradeForm({ ...upgradeForm, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {upgradeForm.plan_id && upgradeForm.plan_id !== selectedTenant.plan_id && (
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-sm">
                  {(() => {
                    const newPlan = plans.find((p: any) => p.id === upgradeForm.plan_id);
                    const oldPlan = plans.find((p: any) => p.id === selectedTenant.plan_id);
                    const isUpgrade = Number(newPlan?.price_monthly) > Number(oldPlan?.price_monthly || 0);
                    return (
                      <div className="flex items-center gap-2">
                        {isUpgrade ? <ArrowUpCircle className="h-5 w-5 text-emerald-500" /> : <ArrowDownCircle className="h-5 w-5 text-amber-500" />}
                        <span>{isUpgrade ? "Upgrade" : "Downgrade"}: {oldPlan?.name || "None"} → {newPlan?.name}</span>
                      </div>
                    );
                  })()}
                  <p className="mt-1 text-muted-foreground">Proration credit will be calculated automatically.</p>
                </div>
              )}
              <Button
                className="w-full"
                disabled={!upgradeForm.plan_id || upgradeTenant.isPending}
                onClick={() => upgradeTenant.mutate({ tenantId: selectedTenant.id, newPlanId: upgradeForm.plan_id, billing_cycle: upgradeForm.billing_cycle })}
              >
                {upgradeTenant.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm Plan Change
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
