import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Globe, CreditCard, MessageSquare, CheckCircle2,
  AlertTriangle, Loader2, Database, MapPin, BookOpen, Mail, Zap,
  Shield, Activity, Clock, TrendingUp, Lightbulb
} from "lucide-react";

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

  const setupMut = useMutation({
    mutationFn: async (step: string) => {
      setSetupRunning(step);
      // Simulate setup process
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

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  }

  if (!tenant) {
    return <div className="text-center py-20 text-muted-foreground">Tenant not found</div>;
  }

  const setupSteps = [
    { key: "geo", label: "Geo Data", icon: MapPin, done: tenant.setup_geo },
    { key: "accounts", label: "Chart of Accounts", icon: BookOpen, done: tenant.setup_accounts },
    { key: "templates", label: "SMS/Email Templates", icon: Mail, done: tenant.setup_templates },
    { key: "ledger", label: "Ledger Settings", icon: Database, done: tenant.setup_ledger },
  ];
  const completedSteps = setupSteps.filter((s) => s.done).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;
  const isFullySetup = tenant.setup_status === "completed" || completedSteps === setupSteps.length;

  // Smart Alerts
  const alerts: { type: "warning" | "error" | "info"; message: string }[] = [];
  if (!isFullySetup) alerts.push({ type: "warning", message: "Setup incomplete — some features may not work properly" });
  if (!subscription) alerts.push({ type: "error", message: "No active subscription assigned" });
  if ((wallet?.balance || 0) < 50) alerts.push({ type: "warning", message: `SMS balance low (${wallet?.balance || 0} remaining)` });
  if (domains.length === 0) alerts.push({ type: "info", message: "No custom domain configured" });
  if (tenant.status === "suspended") alerts.push({ type: "error", message: "Tenant is currently suspended" });

  // AI Suggestions
  const suggestions: string[] = [];
  if (!isFullySetup) suggestions.push("Complete full setup to activate all system features");
  if (!subscription) suggestions.push("Assign a subscription plan to enable billing");
  if ((wallet?.balance || 0) < 100) suggestions.push("Add SMS balance to enable messaging services");
  if (subscription?.plan?.slug === "basic") suggestions.push("Upgrade to Professional plan for accounting & HR modules");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/super/tenants")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" /> {tenant.name}
          </h1>
          <p className="text-muted-foreground">{tenant.subdomain}.smartispapp.com</p>
        </div>
        <Badge variant={tenant.status === "active" ? "default" : "destructive"} className="text-sm px-3 py-1">
          {tenant.status}
        </Badge>
      </div>

      {/* Smart Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              a.type === "error" ? "bg-destructive/10 text-destructive" :
              a.type === "warning" ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" :
              "bg-primary/10 text-primary"
            }`}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Building2 className="h-4 w-4" /> Basic Info</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Email:</span> {tenant.email || "—"}</p>
            <p><span className="text-muted-foreground">Phone:</span> {tenant.phone || "—"}</p>
            <p><span className="text-muted-foreground">Created:</span> {new Date(tenant.created_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Globe className="h-4 w-4" /> Domain</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {domains.length > 0 ? domains.map((d: any) => (
              <div key={d.id} className="flex items-center gap-1">
                <span>{d.domain}</span>
                {d.is_verified && <CheckCircle2 className="h-3 w-3 text-primary" />}
              </div>
            )) : <p className="text-muted-foreground">No domain configured</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><CreditCard className="h-4 w-4" /> Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {subscription ? (
              <>
                <p className="font-medium">{subscription.plan?.name || "—"}</p>
                <p><span className="text-muted-foreground">Cycle:</span> {subscription.billing_cycle}</p>
                <p><span className="text-muted-foreground">Expires:</span> {subscription.end_date}</p>
                <Badge variant={subscription.status === "active" ? "default" : "destructive"} className="mt-1">{subscription.status}</Badge>
              </>
            ) : <p className="text-muted-foreground">No subscription</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><MessageSquare className="h-4 w-4" /> SMS Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallet?.balance || 0}</div>
            <p className="text-xs text-muted-foreground">SMS credits remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Setup Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Setup Progress
              </CardTitle>
              <CardDescription>{completedSteps}/{setupSteps.length} steps completed</CardDescription>
            </div>
            {!isFullySetup && (
              <Button onClick={() => setupMut.mutate("all")} disabled={setupMut.isPending}>
                {setupRunning === "all" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                One-Click Full Setup
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={setupProgress} className="h-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {setupSteps.map((step) => (
              <div key={step.key} className={`flex items-center justify-between p-3 rounded-lg border ${step.done ? "bg-primary/5 border-primary/20" : "bg-muted/50"}`}>
                <div className="flex items-center gap-2">
                  {step.done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <step.icon className="h-5 w-5 text-muted-foreground" />}
                  <span className={step.done ? "text-primary font-medium" : ""}>{step.label}</span>
                </div>
                {!step.done && (
                  <Button variant="outline" size="sm" onClick={() => setupMut.mutate(step.key)} disabled={setupMut.isPending}>
                    {setupRunning === step.key ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import"}
                  </Button>
                )}
                {step.done && <Badge variant="outline" className="text-primary border-primary/30">Done</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
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
                <div key={i} className="flex items-start gap-2 p-3 bg-yellow-500/5 rounded-lg text-sm">
                  <TrendingUp className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" /> Health Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className={`text-lg font-bold ${isFullySetup ? "text-primary" : "text-yellow-600"}`}>
                {isFullySetup ? "✓" : "⚠"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Setup</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className={`text-lg font-bold ${subscription?.status === "active" ? "text-primary" : "text-destructive"}`}>
                {subscription?.status === "active" ? "✓" : "✗"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Subscription</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className={`text-lg font-bold ${(wallet?.balance || 0) > 50 ? "text-primary" : "text-yellow-600"}`}>
                {wallet?.balance || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">SMS</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{tenant.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Status</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
