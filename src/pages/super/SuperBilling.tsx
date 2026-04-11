import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, supabase } from "@/integrations/supabase/client";
import { IS_LOVABLE } from "@/lib/environment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus, Loader2, CreditCard, AlertTriangle, CheckCircle, Clock,
  ArrowUpCircle, ArrowDownCircle, Receipt, DollarSign, Calendar,
  TrendingUp, RefreshCw, Pencil, Trash2, Eye, Download, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { getResolvedBranding, type BrandingData } from "@/lib/brandingHelper";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SuperBilling() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const [showInvoice, setShowInvoice] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [invoiceForm, setInvoiceForm] = useState({ tenant_id: "", plan_id: "", billing_cycle: "monthly", notes: "" });
  const [previewInv, setPreviewInv] = useState<any>(null);

  // Queries
  const { data: tenants = [] } = useQuery({
    queryKey: ["billing-tenants"],
    queryFn: async () => {
      const { data } = await (db.from as any)("tenants").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const { data } = await (db.from as any)("saas_plans").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["subscription-invoices"],
    queryFn: async () => {
      const { data } = await (db.from as any)("subscription_invoices").select("*").order("created_at", { ascending: false });
      const tenantsData = await (db.from as any)("tenants").select("id, name, subdomain");
      const plansData = await (db.from as any)("saas_plans").select("id, name");
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
      const { data } = await (db.from as any)("subscriptions").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Branding for invoice PDF
  const { data: branding } = useQuery({
    queryKey: ["resolved-branding-super"],
    queryFn: () => getResolvedBranding(),
    staleTime: 60_000,
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

      const { error } = await (db.from as any)("subscription_invoices").insert({
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
      await (db.from as any)("subscription_invoices").update({
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

      await (db.from as any)("tenants").update({
        plan_expire_date: newExpiry.toISOString().split("T")[0],
        plan_id: invoice.plan_id,
        status: "active",
      }).eq("id", invoice.tenant_id);

      // Update subscription
      await (db.from as any)("subscriptions").update({ status: "active" })
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

      await (db.from as any)("subscription_invoices").insert({
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
      await (db.from as any)("tenants").update({ plan_id: newPlanId }).eq("id", tenantId);
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
      const { data, error } = await db.functions.invoke("plan-check");
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
    if (s === "pending") return <Badge variant="outline" className="text-amber-600"><Clock className="h-3 w-3 mr-1" />{sa.pending}</Badge>;
    return <Badge variant="destructive">{s}</Badge>;
  };

  const [upgradeForm, setUpgradeForm] = useState({ plan_id: "", billing_cycle: "monthly" });

  // Edit invoice
  const [editOpen, setEditOpen] = useState(false);
  const [editInv, setEditInv] = useState<any>(null);

  const editInvoice = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await (db.from as any)("subscription_invoices").update({
        amount: Number(form.amount),
        tax_amount: Number(form.tax_amount || 0),
        total_amount: Number(form.total_amount),
        billing_cycle: form.billing_cycle,
        due_date: form.due_date,
        notes: form.notes || null,
        status: form.status,
      }).eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice updated");
      setEditOpen(false);
      setEditInv(null);
      qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete invoice
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (db.from as any)("subscription_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice deleted");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{sa.saasBilling}</h1>
          <p className="text-muted-foreground">Manage invoices, plan changes, and payment tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runPlanCheck.mutate()} disabled={runPlanCheck.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${runPlanCheck.isPending ? "animate-spin" : ""}`} /> {sa.runExpiryCheck}
          </Button>
          <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />{sa.generateInvoice}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{sa.generateSubInvoice}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); generateInvoice.mutate(invoiceForm); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>{sa.tenant}</Label>
                  <Select value={invoiceForm.tenant_id} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, tenant_id: v })}>
                    <SelectTrigger><SelectValue placeholder={sa.selectTenant} /></SelectTrigger>
                    <SelectContent>{tenants.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{sa.plan}</Label>
                  <Select value={invoiceForm.plan_id} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, plan_id: v })}>
                    <SelectTrigger><SelectValue placeholder={sa.selectPlan} /></SelectTrigger>
                    <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{sa.billingCycle}</Label>
                  <Select value={invoiceForm.billing_cycle} onValueChange={(v) => setInvoiceForm({ ...invoiceForm, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{sa.monthly}</SelectItem>
                      <SelectItem value="yearly">{sa.yearly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{sa.notes}</Label>
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
          <AlertTitle>{sa.planExpiryAlerts}</AlertTitle>
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
            <div><p className="text-sm text-muted-foreground">{sa.totalRevenue}</p><p className="text-2xl font-bold">৳{totalRevenue.toLocaleString()}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div><p className="text-sm text-muted-foreground">{sa.pending}</p><p className="text-2xl font-bold">৳{pendingAmount.toLocaleString()}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">{sa.activeSubs}</p><p className="text-2xl font-bold">{activeSubCount}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div><p className="text-sm text-muted-foreground">{sa.expiringSoon}</p><p className="text-2xl font-bold">{expiringTenants.filter((t: any) => t.days_left >= 0).length}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices"><Receipt className="h-4 w-4 mr-1" />{sa.invoices}</TabsTrigger>
          <TabsTrigger value="tenants"><TrendingUp className="h-4 w-4 mr-1" />{sa.tenantPlanOverview}</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader><CardTitle>{sa.subscriptionInvoices}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{sa.tenant}</TableHead>
                    <TableHead>{sa.plan}</TableHead>
                    <TableHead>{sa.cycle}</TableHead>
                    <TableHead>{sa.amount}</TableHead>
                    <TableHead>{sa.proration}</TableHead>
                    <TableHead>{sa.total}</TableHead>
                    <TableHead>{sa.dueDate}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInvoices ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{sa.noInvoicesYet}</TableCell></TableRow>
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
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setPreviewInv(inv)} title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {inv.status === "pending" && (
                            <Button size="sm" onClick={() => markPaid.mutate(inv.id)} disabled={markPaid.isPending}>
                              <CheckCircle className="h-3 w-3 mr-1" /> {sa.markPaid}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => { setEditInv({ ...inv, amount: inv.amount, tax_amount: inv.tax_amount || 0, total_amount: inv.total_amount, billing_cycle: inv.billing_cycle, due_date: inv.due_date, notes: inv.notes || "", status: inv.status }); setEditOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(inv.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
            <CardHeader><CardTitle>{sa.tenantPlanOverview}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{sa.tenant}</TableHead>
                    <TableHead>{sa.currentPlanLabel}</TableHead>
                    <TableHead>{sa.expiryDate}</TableHead>
                    <TableHead>{sa.graceDays}</TableHead>
                    <TableHead>{sa.daysLeftLabel}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>{t.common.actions}</TableHead>
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
                <Label>{sa.newPlan}</Label>
                <Select value={upgradeForm.plan_id} onValueChange={(v) => setUpgradeForm({ ...upgradeForm, plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder={sa.selectPlan} /></SelectTrigger>
                  <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo | ৳{p.price_yearly}/yr</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{sa.billingCycle}</Label>
                <Select value={upgradeForm.billing_cycle} onValueChange={(v) => setUpgradeForm({ ...upgradeForm, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{sa.monthly}</SelectItem>
                    <SelectItem value="yearly">{sa.yearly}</SelectItem>
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

      {/* Edit Invoice Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditInv(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sa.editInvoice}</DialogTitle></DialogHeader>
          {editInv && (
            <form onSubmit={(e) => { e.preventDefault(); editInvoice.mutate(editInv); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{sa.amount}</Label>
                  <Input type="number" step="0.01" value={editInv.amount} onChange={(e) => setEditInv({ ...editInv, amount: e.target.value, total_amount: (Number(e.target.value) + Number(editInv.tax_amount) - Number(editInv.proration_credit || 0)).toFixed(2) })} />
                </div>
                <div className="space-y-2">
                  <Label>{sa.tax}</Label>
                  <Input type="number" step="0.01" value={editInv.tax_amount} onChange={(e) => setEditInv({ ...editInv, tax_amount: e.target.value, total_amount: (Number(editInv.amount) + Number(e.target.value) - Number(editInv.proration_credit || 0)).toFixed(2) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{sa.total}</Label>
                  <Input type="number" step="0.01" value={editInv.total_amount} onChange={(e) => setEditInv({ ...editInv, total_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{sa.dueDate}</Label>
                  <Input type="date" value={editInv.due_date || ""} onChange={(e) => setEditInv({ ...editInv, due_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{sa.billingCycle}</Label>
                  <Select value={editInv.billing_cycle} onValueChange={(v) => setEditInv({ ...editInv, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{sa.monthly}</SelectItem>
                      <SelectItem value="yearly">{sa.yearly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.common.status}</Label>
                  <Select value={editInv.status} onValueChange={(v) => setEditInv({ ...editInv, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{sa.pending}</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">{sa.overdue}</SelectItem>
                      <SelectItem value="cancelled">{t.common.cancel}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={editInv.notes} onChange={(e) => setEditInv({ ...editInv, notes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={editInvoice.isPending}>
                {editInvoice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Update Invoice
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sa.deleteInvoice}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this invoice? This action cannot be undone.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteInvoice.mutate(deleteId)} disabled={deleteInvoice.isPending}>
              {deleteInvoice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invoice Preview Dialog (Same design as Tenant side) ── */}
      <Dialog open={!!previewInv} onOpenChange={(o) => { if (!o) setPreviewInv(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">Invoice Preview</DialogTitle>
          {previewInv && (() => {
            const b = branding || { software_name: "Smart ISP", company_name: "Smart ISP", address: "", support_email: "", support_phone: "", logo_url: null, footer_text: "", copyright_text: "", email: "", mobile: "" };
            const tenantData = tenants.find((t: any) => t.id === previewInv.tenant_id);
            const planName = previewInv.plan?.name || plans.find((p: any) => p.id === previewInv.plan_id)?.name || "N/A";
            return (
              <div className="bg-white text-gray-900" style={{ background: "#ffffff" }}>
                <div className="p-8 md:p-10 max-w-[800px] mx-auto">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                          {b.company_name?.charAt(0) || "S"}
                        </div>
                      )}
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{b.company_name}</h2>
                        {b.address && <p className="text-xs text-gray-500">{b.address}</p>}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-bold ${
                      previewInv.status === "paid" ? "bg-emerald-500 text-white"
                      : previewInv.status === "overdue" ? "bg-red-500 text-white"
                      : "bg-amber-500 text-white"
                    }`}>
                      {(previewInv.status || "pending").toUpperCase()}
                    </span>
                  </div>

                  <h1 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-3">
                    Invoice #{previewInv.id?.substring(0, 8).toUpperCase() || "N/A"}
                  </h1>

                  {/* Invoiced To / Pay To */}
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">{sa.invoicedTo}</h3>
                      <p className="text-sm font-semibold text-gray-900">{tenantData?.name || "—"}</p>
                      {tenantData?.email && <p className="text-xs text-gray-500">{tenantData.email}</p>}
                      {tenantData?.phone && <p className="text-xs text-gray-500">{tenantData.phone}</p>}
                      {tenantData?.subdomain && <p className="text-xs text-gray-500">{tenantData.subdomain}</p>}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">{sa.payTo}</h3>
                      <p className="text-sm font-semibold text-gray-900">{b.company_name}</p>
                      {b.address && <p className="text-xs text-gray-500">{b.address}</p>}
                      {(b.support_phone || b.mobile) && <p className="text-xs text-gray-500">{b.support_phone || b.mobile}</p>}
                    </div>
                  </div>

                  {/* Date Row */}
                  <div className="grid grid-cols-3 gap-6 mb-6 border-t border-b border-gray-100 py-3">
                    <div>
                      <span className="text-xs font-bold text-gray-500">{sa.invoiceDate}</span>
                      <p className="text-sm text-gray-800">
                        {previewInv.created_at ? format(new Date(previewInv.created_at), "dd-MM-yyyy") : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500">{sa.dueDate}</span>
                      <p className="text-sm text-gray-800">
                        {previewInv.due_date ? format(new Date(previewInv.due_date), "dd-MM-yyyy") : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500">{sa.paymentMethod}</span>
                      <p className="text-sm text-gray-800">{previewInv.payment_method || "N/A"}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <h3 className="text-center text-base font-bold text-gray-800 mb-3">{sa.invoiceItems}</h3>
                  <table className="w-full text-sm mb-2">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-2 font-bold text-gray-600">{t.common.description}</th>
                        <th className="text-center py-2 font-bold text-gray-600">{sa.quantity}</th>
                        <th className="text-right py-2 font-bold text-gray-600">{sa.rate}</th>
                        <th className="text-right py-2 font-bold text-gray-600">{sa.amount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-gray-800">{planName} Subscription</td>
                        <td className="py-2 text-center text-gray-600">
                          1 {(previewInv.billing_cycle || "monthly") === "yearly" ? "Year" : "Month"}
                        </td>
                        <td className="py-2 text-right text-gray-600">{Number(previewInv.amount || 0).toFixed(2)} TK</td>
                        <td className="py-2 text-right font-semibold text-gray-800">{Number(previewInv.amount || 0).toFixed(2)} TK</td>
                      </tr>
                      {Number(previewInv.proration_credit || 0) > 0 && (
                        <tr className="border-b border-gray-100">
                          <td className="py-2 text-emerald-700">{sa.prorationCredit}</td>
                          <td className="py-2 text-center text-gray-600">-</td>
                          <td className="py-2 text-right text-gray-600">-</td>
                          <td className="py-2 text-right text-emerald-700">-{Number(previewInv.proration_credit).toFixed(2)} TK</td>
                        </tr>
                      )}
                      {Number(previewInv.tax_amount || 0) > 0 && (
                        <tr className="border-b border-gray-100">
                          <td className="py-2 text-gray-800">{sa.tax}</td>
                          <td className="py-2 text-center text-gray-600">-</td>
                          <td className="py-2 text-right text-gray-600">-</td>
                          <td className="py-2 text-right text-gray-800">{Number(previewInv.tax_amount).toFixed(2)} TK</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300">
                        <td colSpan={3} className="py-2 text-right font-bold text-gray-700">{sa.total}</td>
                        <td className="py-2 text-right font-bold text-gray-900">{Number(previewInv.total_amount || 0).toFixed(2)} TK</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Notes */}
                  {previewInv.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-600">
                      <strong>{sa.notes}:</strong> {previewInv.notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-gray-100">
                    <Button size="sm" onClick={() => generateSuperInvoicePDF(previewInv, tenantData, branding || b, planName)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Printer className="h-4 w-4" /> Print
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => generateSuperInvoicePDF(previewInv, tenantData, branding || b, planName)} className="gap-1.5">
                      <Download className="h-4 w-4" /> Download PDF
                    </Button>
                  </div>

                  {b.footer_text && (
                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                      <p className="text-xs text-gray-400">{b.footer_text}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Clean White PDF Generator (Super Admin Side — same design as Tenant)
// ═══════════════════════════════════════════════════════════════
function generateSuperInvoicePDF(invoice: any, tenantData: any, branding: any, planName: string) {
  const doc = new jsPDF("p", "mm", "a4");
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, ph, "F");

  let y = 20;

  // Company header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text(branding.company_name || "Smart ISP", m, y);

  if (branding.address) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(branding.address, m, y + 5);
  }

  // Status badge
  const statusText = (invoice.status || "pending").toUpperCase();
  if (invoice.status === "paid") doc.setFillColor(16, 150, 72);
  else if (invoice.status === "overdue") doc.setFillColor(210, 50, 50);
  else doc.setFillColor(200, 150, 30);

  const badgeW = doc.getTextWidth(statusText) * 0.35 + 10;
  doc.roundedRect(pw - m - badgeW, y - 4, badgeW, 7, 1.5, 1.5, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, pw - m - badgeW / 2, y, { align: "center" });

  y += 14;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(m, y, pw - m, y);
  y += 8;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text(`Invoice #${(invoice.id || "").substring(0, 8).toUpperCase()}`, m, y);
  y += 10;

  // Two columns
  const colMid = pw / 2;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("Invoiced To", m, y);
  doc.text("Pay To", colMid + 5, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text(tenantData?.name || "Tenant", m, y);
  doc.text(branding.company_name || "Smart ISP", colMid + 5, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);

  let leftY = y;
  if (tenantData?.email) { doc.text(tenantData.email, m, leftY); leftY += 4; }
  if (tenantData?.phone) { doc.text(tenantData.phone, m, leftY); leftY += 4; }
  if (tenantData?.subdomain) { doc.text(tenantData.subdomain, m, leftY); leftY += 4; }

  let rightY = y;
  if (branding.address) { doc.text(branding.address, colMid + 5, rightY); rightY += 4; }
  if (branding.support_phone || branding.mobile) { doc.text(branding.support_phone || branding.mobile, colMid + 5, rightY); rightY += 4; }

  y = Math.max(leftY, rightY) + 4;

  // Date row
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("Invoice Date", m, y);
  doc.text("Due Date", colMid / 2 + m / 2 + 15, y);
  doc.text("Payment Method", colMid + 5, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(9);
  doc.text(invoice.created_at ? format(new Date(invoice.created_at), "dd-MM-yyyy") : "-", m, y);
  doc.text(invoice.due_date ? format(new Date(invoice.due_date), "dd-MM-yyyy") : "-", colMid / 2 + m / 2 + 15, y);
  doc.text(invoice.payment_method || "N/A", colMid + 5, y);
  y += 10;

  // Items
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text("Invoice Items", pw / 2, y, { align: "center" });
  y += 7;

  const cols = [m, m + 70, m + 110, pw - m];
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(m, y, pw - m, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("Description", cols[0], y);
  doc.text("Quantity", cols[1], y);
  doc.text("Rate", cols[2], y);
  doc.text("Amount", cols[3] - 2, y, { align: "right" });
  y += 3;
  doc.line(m, y, pw - m, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  const cycle = (invoice.billing_cycle || "monthly") === "yearly" ? "1 Year" : "1 Month";
  doc.text(`${planName} Subscription`, cols[0], y);
  doc.text(cycle, cols[1], y);
  doc.text(`${Number(invoice.amount || 0).toFixed(2)} TK`, cols[2], y);
  doc.text(`${Number(invoice.amount || 0).toFixed(2)} TK`, cols[3] - 2, y, { align: "right" });
  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(m, y, pw - m, y);
  y += 5;

  if (Number(invoice.proration_credit || 0) > 0) {
    doc.setTextColor(16, 150, 72);
    doc.text("Proration Credit", cols[0], y);
    doc.text("-", cols[1], y);
    doc.text("-", cols[2], y);
    doc.text(`-${Number(invoice.proration_credit).toFixed(2)} TK`, cols[3] - 2, y, { align: "right" });
    y += 4;
    doc.setTextColor(50, 50, 50);
    doc.line(m, y, pw - m, y);
    y += 5;
  }

  if (Number(invoice.tax_amount || 0) > 0) {
    doc.text("Tax", cols[0], y);
    doc.text("-", cols[1], y);
    doc.text("-", cols[2], y);
    doc.text(`${Number(invoice.tax_amount).toFixed(2)} TK`, cols[3] - 2, y, { align: "right" });
    y += 4;
    doc.line(m, y, pw - m, y);
    y += 5;
  }

  // Total
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.line(cols[2] - 10, y - 2, pw - m, y - 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(10);
  doc.text("Total", cols[2], y + 2);
  doc.text(`${Number(invoice.total_amount || 0).toFixed(2)} TK`, cols[3] - 2, y + 2, { align: "right" });

  // Footer
  const footerY = ph - 20;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(m, footerY - 5, pw - m, footerY - 5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  if (branding.footer_text) doc.text(branding.footer_text, pw / 2, footerY, { align: "center" });
  const contactLine = [branding.support_phone || branding.mobile, branding.support_email || branding.email].filter(Boolean).join("  |  ");
  if (contactLine) doc.text(contactLine, pw / 2, footerY + 4, { align: "center" });

  doc.save(`invoice-${(invoice.id || "").substring(0, 8)}-${format(new Date(invoice.created_at || new Date()), "yyyyMMdd")}.pdf`);
}
