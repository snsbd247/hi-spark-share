import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
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
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Globe, CreditCard, MessageSquare, CheckCircle2,
  AlertTriangle, Loader2, Database, MapPin, BookOpen, Mail, Zap,
  Shield, Activity, Clock, TrendingUp, Lightbulb, Plus, Ban,
  RefreshCw, Trash2, ExternalLink, Phone, AtSign, Calendar
} from "lucide-react";

// ─── SMS Recharge Dialog ─────────────────────────────────────
function SmsRechargeDialog({ tenantId, currentBalance, onSuccess }: {
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
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Recharge</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>SMS Balance Recharge</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold">{currentBalance}</p>
          </div>
          <div className="space-y-2">
            <Label>Amount (SMS Credits)</Label>
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
            <Label>Note (optional)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Recharge description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
function DomainAddDialog({ tenantId, onSuccess }: { tenantId: string; onSuccess: () => void }) {
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
        <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add Domain</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Custom Domain</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Domain Name</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="billing.yourisp.com" />
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">DNS Configuration</p>
            <p>Add an A record pointing to: <code className="bg-muted px-1 rounded">185.158.133.1</code></p>
            <p>Or CNAME to: <code className="bg-muted px-1 rounded">smartispapp.com</code></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
function SubscriptionDialog({ tenantId, currentSub, onSuccess }: {
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
              <p className="text-muted-foreground">Current Plan</p>
              <p className="font-medium">{currentSub.plan?.name} — {currentSub.billing_cycle}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Select Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
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
            <Label>Billing Cycle</Label>
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => assign.mutate()} disabled={!planId || assign.isPending}>
            {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Assign Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function SuperTenantProfile() {
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

  const setupMut = useMutation({
    mutationFn: async (step: string) => {
      setSetupRunning(step);
      await new Promise((r) => setTimeout(r, 1500));
      return superAdminApi.updateTenant(id!, {
        [`setup_${step}`]: true,
        ...(step === "all" ? { setup_geo: true, setup_accounts: true, setup_templates: true, setup_ledger: true, setup_status: "completed" } : {}),
      });
    },
    onSuccess: (_, step) => {
      toast.success(`${step === "all" ? "Full setup" : step} completed!`);
      setSetupRunning(null);
      qc.invalidateQueries({ queryKey: ["super-tenant", id] });
    },
    onError: (e: any) => { toast.error(e.message); setSetupRunning(null); },
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
        <p className="text-muted-foreground">Tenant not found</p>
        <Button variant="link" onClick={() => navigate("/super/tenants")}>Back to Tenants</Button>
      </div>
    );
  }

  const setupSteps = [
    { key: "geo", label: "Geo Data (Division/District/Upazila)", icon: MapPin, done: tenant.setup_geo },
    { key: "accounts", label: "Chart of Accounts", icon: BookOpen, done: tenant.setup_accounts },
    { key: "templates", label: "SMS/Email Templates", icon: Mail, done: tenant.setup_templates },
    { key: "ledger", label: "Ledger Mapping Settings", icon: Database, done: tenant.setup_ledger },
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
        <div className="flex items-center gap-2 self-start">
          <Badge variant={tenant.status === "active" ? "default" : "destructive"} className="text-sm px-3 py-1 capitalize">
            {tenant.status}
          </Badge>
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
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">default</span>
              <span className="truncate">{tenant.subdomain}.smartispapp.com</span>
            </div>
            {domains.length > 0 ? domains.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-1.5 truncate">
                  {d.is_verified ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  )}
                  <span className="truncate">{d.domain}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeDomainMut.mutate(d.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            )) : null}
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
                <p className="font-semibold text-base">{subscription.plan?.name || "—"}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{subscription.billing_cycle}</Badge>
                  <Badge variant={subscription.status === "active" ? "default" : "destructive"} className="text-xs">{subscription.status}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">৳{Number(subscription.amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-medium">{subscription.end_date || "—"}</span>
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

      {/* ── Setup Progress ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> System Setup
              </CardTitle>
              <CardDescription className="mt-1">
                {isFullySetup ? "All setup steps completed ✓" : `${completedSteps} of ${setupSteps.length} steps completed`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {!isFullySetup && (
                <Button onClick={() => setupMut.mutate("all")} disabled={setupMut.isPending}>
                  {setupRunning === "all" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  One-Click Full Setup
                </Button>
              )}
              {isFullySetup && (
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
                  <div>
                    <span className={`text-sm ${step.done ? "text-primary font-medium" : "text-foreground"}`}>{step.label}</span>
                  </div>
                </div>
                {!step.done ? (
                  <Button variant="outline" size="sm" onClick={() => setupMut.mutate(step.key)} disabled={setupMut.isPending} className="h-8">
                    {setupRunning === step.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Import"}
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-primary border-primary/30">Done</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── SMS Transaction History ────────────────────────── */}
      {smsTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5" /> SMS Transaction History
            </CardTitle>
            <CardDescription>Recent SMS balance transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smsTransactions.slice(0, 10).map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{new Date(tx.created_at).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === "credit" ? "default" : "secondary"} className="text-xs capitalize">
                        {tx.type}
                      </Badge>
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
      )}

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
    </div>
  );
}
