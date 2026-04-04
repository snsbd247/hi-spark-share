import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { runSetupStep, setupAll } from "@/lib/tenantSetupService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Building2, Globe, CreditCard, Database, CheckCircle2, AlertCircle,
  ArrowRight, ArrowLeft, Loader2, Rocket, Zap, MapPin, BookOpen,
  Mail, Shield, MessageSquare, Plus, Info
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Step definitions ────────────────────────────────────────
const STEP_ICONS = [Building2, Globe, CreditCard, Database, Rocket];
const SETUP_ICON_MAP: Record<string, any> = { geo: MapPin, accounts: BookOpen, templates: Mail, ledger: Shield, payment_gateways: CreditCard };
const SETUP_KEYS = ["geo", "accounts", "templates", "ledger", "payment_gateways"];

// ─── Local persistence helpers ───────────────────────────────
const STORAGE_KEY = "onboarding_draft";

interface WizardState {
  step: number;
  tenantId: string | null;
  tenantForm: { name: string; subdomain: string; email: string; phone: string };
  domainForm: { domain: string };
  planForm: { plan_id: string; billing_cycle: string };
  autoSetup: boolean;
  setupProgress: Record<string, boolean>;
  smsRecharge: number;
  stepsCompleted: boolean[];
}

const defaultState: WizardState = {
  step: 0,
  tenantId: null,
  tenantForm: { name: "", subdomain: "", email: "", phone: "" },
  domainForm: { domain: "" },
  planForm: { plan_id: "", billing_cycle: "monthly" },
  autoSetup: true,
  setupProgress: { geo: false, accounts: false, templates: false, ledger: false },
  smsRecharge: 500,
  stepsCompleted: [false, false, false, false, false],
};

function loadDraft(): WizardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultState };
}

function saveDraft(state: WizardState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Component ───────────────────────────────────────────────
export default function SuperOnboarding() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const STEPS = [
    { key: "tenant", label: sa.stepCreateTenant, icon: Building2, desc: sa.stepCreateTenantDesc },
    { key: "domain", label: sa.stepAssignDomain, icon: Globe, desc: sa.stepAssignDomainDesc },
    { key: "plan", label: sa.stepAssignPlan, icon: CreditCard, desc: sa.stepAssignPlanDesc },
    { key: "data", label: sa.stepImportData, icon: Database, desc: sa.stepImportDataDesc },
    { key: "activate", label: sa.stepActivate, icon: Rocket, desc: sa.stepActivateDesc },
  ];

  const SETUP_ITEMS = [
    { key: "geo", label: sa.setupGeoData, icon: MapPin },
    { key: "accounts", label: sa.setupAccounts, icon: BookOpen },
    { key: "templates", label: sa.setupTemplates, icon: Mail },
    { key: "ledger", label: sa.setupLedger, icon: Shield },
    { key: "payment_gateways", label: sa.setupPaymentGateways, icon: CreditCard },
  ];
  const qc = useQueryClient();

  const [ws, setWs] = useState<WizardState>(() => {
    const draft = loadDraft();
    const resumeParam = searchParams.get("resume");
    if (resumeParam === "true" && draft.tenantId) return draft;
    return { ...defaultState };
  });

  const { step, tenantId: createdTenantId, tenantForm, domainForm, planForm, autoSetup, setupProgress, smsRecharge, stepsCompleted } = ws;

  // Persist on every change
  useEffect(() => { saveDraft(ws); }, [ws]);

  const update = useCallback((patch: Partial<WizardState>) => {
    setWs((prev) => ({ ...prev, ...patch }));
  }, []);

  const markStep = useCallback((idx: number) => {
    setWs((prev) => {
      const sc = [...prev.stepsCompleted];
      sc[idx] = true;
      return { ...prev, stepsCompleted: sc };
    });
  }, []);

  const { data: plans = [] } = useQuery({ queryKey: ["super-plans"], queryFn: superAdminApi.getPlans });

  const hasDraft = !!loadDraft().tenantId;

  // ── Step 0: Create Tenant ──────────────────────────────────
  const createTenant = useMutation({
    mutationFn: superAdminApi.createTenant,
    onSuccess: (data: any) => {
      const id = Array.isArray(data) ? data[0]?.id : data?.id;
      update({ tenantId: id, step: 1 });
      markStep(0);
      toast.success(sa.tenantCreatedMsg);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Step 1: Domain ─────────────────────────────────────────
  const assignDomain = useMutation({
    mutationFn: () => superAdminApi.assignDomain({ tenant_id: createdTenantId, domain: domainForm.domain }),
    onSuccess: () => { update({ step: 2 }); markStep(1); toast.success(sa.domainAssignedMsg); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Step 2: Plan ───────────────────────────────────────────
  const assignPlan = useMutation({
    mutationFn: () => superAdminApi.assignSubscription({ tenant_id: createdTenantId, ...planForm }),
    onSuccess: () => { update({ step: 3 }); markStep(2); toast.success(sa.planAssignedMsg); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Step 3: Individual setup item ──────────────────────────
  const [runningItem, setRunningItem] = useState<string | null>(null);

  const runSetupItem = useMutation({
    mutationFn: async (itemKey: string) => {
      setRunningItem(itemKey);
      const result = await runSetupStep(itemKey);
      if (!result.success) throw new Error(result.message);
      if (createdTenantId) {
        await superAdminApi.updateTenant(createdTenantId, { [`setup_${itemKey}`]: true });
      }
      return result;
    },
    onSuccess: (result, itemKey) => {
      const newProgress = { ...setupProgress, [itemKey]: true };
      update({ setupProgress: newProgress });
      setRunningItem(null);
      toast.success(`${itemKey} imported${result?.count ? ` (${result.count} records)` : ""}!`);
    },
    onError: (e: any) => { setRunningItem(null); toast.error(e.message || "Import failed"); },
  });

  const runFullSetup = useMutation({
    mutationFn: async () => {
      setRunningItem("all");
      const result = await setupAll();
      if (createdTenantId) {
        await superAdminApi.updateTenant(createdTenantId, {
          setup_geo: result.geo.success,
          setup_accounts: result.accounts.success,
          setup_templates: result.templates.success,
          setup_ledger: result.ledger.success,
          setup_payment_gateways: result.paymentGateways.success,
          setup_status: result.overall ? "completed" : "partial",
        });
      }
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
      return result;
    },
    onSuccess: (result) => {
      const allDone: Record<string, boolean> = {};
      SETUP_ITEMS.forEach((i) => (allDone[i.key] = true));
      update({ setupProgress: allDone, step: 4 });
      markStep(3);
      setRunningItem(null);
      toast.success(sa.fullSetupCompletedMsg);
    },
    onError: (e: any) => { setRunningItem(null); toast.error(e.message || "Setup failed"); },
  });

  // ── Step 4: Activate ───────────────────────────────────────
  const activateTenant = useMutation({
    mutationFn: async () => {
      if (!createdTenantId) return;
      // Optional SMS recharge
      if (smsRecharge > 0) {
        await superAdminApi.rechargeSms({
          tenant_id: createdTenantId,
          amount: smsRecharge,
          description: "Initial SMS balance from onboarding",
        });
      }
      await superAdminApi.activateTenant(createdTenantId);
    },
    onSuccess: () => {
      markStep(4);
      toast.success(sa.tenantActivatedSuccess);
      clearDraft();
      qc.invalidateQueries({ queryKey: ["super-tenants"] });
      setTimeout(() => navigate(`/super/tenants/${createdTenantId}`), 1000);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isPending = createTenant.isPending || assignDomain.isPending || assignPlan.isPending ||
    runSetupItem.isPending || runFullSetup.isPending || activateTenant.isPending;

  const setupDoneCount = Object.values(setupProgress).filter(Boolean).length;
  const allSetupDone = setupDoneCount === SETUP_ITEMS.length;
  const selectedPlan = plans.find((p: any) => p.id === planForm.plan_id);

  const canGoBack = step > 0 && step < 4 && (step > 1 || !createdTenantId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="h-6 w-6" /> {sa.newTenantOnboarding}
          </h1>
          <p className="text-muted-foreground text-sm">Step-by-step ISP tenant setup wizard</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1">
            ${sa.stepOf.replace("{current}", String(step + 1)).replace("{total}", String(STEPS.length))}
          </Badge>
          {createdTenantId && (
            <Button variant="ghost" size="sm" onClick={() => { clearDraft(); setWs({ ...defaultState }); }}>
              Start Over
            </Button>
          )}
        </div>
      </div>

      {/* Draft resume banner */}
      {hasDraft && step === 0 && !createdTenantId && loadDraft().tenantId && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <span>{sa.unfinishedOnboarding}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setWs(loadDraft())}>
            Resume
          </Button>
        </div>
      )}

      {/* Stepper Progress */}
      <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
      <div className="flex justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isComplete = stepsCompleted[i];
          const isCurrent = i === step;
          const isFuture = i > step;
          return (
            <div key={i} className={`flex flex-col items-center gap-1.5 transition-colors ${
              isComplete ? "text-primary" : isCurrent ? "text-primary" : "text-muted-foreground"
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                isComplete ? "bg-primary text-primary-foreground" :
                isCurrent ? "border-2 border-primary bg-primary/10" :
                "border border-muted-foreground/30"
              }`}>
                {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className="text-[10px] sm:text-xs text-center leading-tight max-w-[60px] sm:max-w-none">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Step Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5" />; })()}
            {STEPS[step].label}
          </CardTitle>
          <CardDescription>{STEPS[step].desc}</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 space-y-5">

          {/* ═══ Step 0: Create Tenant ═══════════════════════ */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{sa.ispName} <span className="text-destructive">*</span></Label>
                  <Input value={tenantForm.name} onChange={(e) => update({ tenantForm: { ...tenantForm, name: e.target.value } })} placeholder="e.g. SpeedNet BD" />
                </div>
                <div className="space-y-2">
                  <Label>{sa.subdomain} <span className="text-destructive">*</span></Label>
                  <div className="flex items-center gap-1">
                    <Input value={tenantForm.subdomain} onChange={(e) => update({ tenantForm: { ...tenantForm, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") } })} placeholder="speednet" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">.smartispapp.com</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{sa.emailUsername} <span className="text-destructive">*</span></Label>
                  <Input type="email" value={tenantForm.email} onChange={(e) => update({ tenantForm: { ...tenantForm, email: e.target.value } })} placeholder="admin@speednet.com" />
                </div>
                <div className="space-y-2">
                  <Label>{sa.mobile}</Label>
                  <Input value={tenantForm.phone} onChange={(e) => update({ tenantForm: { ...tenantForm, phone: e.target.value } })} placeholder="01XXXXXXXXX" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => createTenant.mutate(tenantForm)} disabled={isPending || !tenantForm.name || !tenantForm.subdomain || !tenantForm.email} size="lg">
                  {createTenant.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  {sa.createAndContinue}
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 1: Domain ══════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="p-3 rounded-lg bg-muted/50 text-sm flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>Default subdomain: <strong>{tenantForm.subdomain}.smartispapp.com</strong> is already active. Custom domain is optional.</span>
              </div>
              <div className="space-y-2">
                <Label>{sa.customDomainOptional}</Label>
                <Input value={domainForm.domain} onChange={(e) => update({ domainForm: { domain: e.target.value } })} placeholder="billing.yourisp.com" />
              </div>
              {domainForm.domain && (
                <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground text-sm">{sa.dnsInstructions}</p>
                  <p>Add an <strong>A record</strong> → <code className="bg-muted px-1 rounded">185.158.133.1</code></p>
                  <p>Or <strong>CNAME</strong> → <code className="bg-muted px-1 rounded">smartispapp.com</code></p>
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => update({ step: 0 })} disabled={isPending}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { update({ step: 2 }); markStep(1); }}>
                    Skip
                  </Button>
                  <Button onClick={() => assignDomain.mutate()} disabled={isPending || !domainForm.domain}>
                    {assignDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                    {sa.assignAndContinue}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Step 2: Plan ════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>{sa.subscriptionPlan} <span className="text-destructive">*</span></Label>
                <Select value={planForm.plan_id} onValueChange={(v) => update({ planForm: { ...planForm, plan_id: v } })}>
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

              {selectedPlan && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-bold">৳{selectedPlan.price_monthly}</p>
                    <p className="text-xs text-muted-foreground">{sa.monthly}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-bold">৳{selectedPlan.price_yearly}</p>
                    <p className="text-xs text-muted-foreground">{sa.yearly}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-bold">{selectedPlan.max_customers || "∞"}</p>
                    <p className="text-xs text-muted-foreground">{sa.maxCustomers}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-bold">{selectedPlan.max_users || "∞"}</p>
                    <p className="text-xs text-muted-foreground">{sa.maxUsers}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{sa.billingCycle}</Label>
                <Select value={planForm.billing_cycle} onValueChange={(v) => update({ planForm: { ...planForm, billing_cycle: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{sa.monthly}</SelectItem>
                    <SelectItem value="yearly">{sa.yearly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => update({ step: 1 })} disabled={isPending}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={() => assignPlan.mutate()} disabled={isPending || !planForm.plan_id}>
                  {assignPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  {sa.assignPlanBtn}
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 3: Import Data ═════════════════════════ */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Auto/Manual toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">{sa.autoImportAll}</p>
                  <p className="text-sm text-muted-foreground">Automatically import all data at once</p>
                </div>
                <Switch checked={autoSetup} onCheckedChange={(v) => update({ autoSetup: v })} />
              </div>

              {/* Individual items */}
              <div className="space-y-2">
                {SETUP_ITEMS.map((item) => {
                  const done = setupProgress[item.key];
                  const Icon = item.icon;
                  const isRunning = runningItem === item.key || runningItem === "all";
                  return (
                    <div key={item.key} className={`flex items-center justify-between p-3.5 rounded-lg border transition-colors ${
                      done ? "bg-primary/5 border-primary/20" : "bg-card"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          done ? "bg-primary/10" : "bg-muted"
                        }`}>
                          {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <span className={`text-sm ${done ? "text-primary font-medium" : "text-foreground"}`}>{item.label}</span>
                      </div>
                      {done ? (
                        <Badge variant="outline" className="text-primary border-primary/30 text-xs">{sa.done}</Badge>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8" onClick={() => runSetupItem.mutate(item.key)} disabled={isPending || autoSetup}>
                          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Import"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{sa.importProgress}</span>
                  <span>{setupDoneCount}/{SETUP_ITEMS.length}</span>
                </div>
                <Progress value={(setupDoneCount / SETUP_ITEMS.length) * 100} className="h-2" />
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => update({ step: 2 })} disabled={isPending}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="flex gap-2">
                  {!allSetupDone && !autoSetup && (
                    <Button variant="outline" onClick={() => { update({ step: 4 }); markStep(3); }}>
                      {sa.skipSetupLater}
                    </Button>
                  )}
                  {autoSetup && !allSetupDone && (
                    <Button onClick={() => runFullSetup.mutate()} disabled={isPending}>
                      {runFullSetup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                      {sa.runFullSetupBtn}
                    </Button>
                  )}
                  {allSetupDone && (
                    <Button onClick={() => { update({ step: 4 }); markStep(3); }}>
                      <ArrowRight className="h-4 w-4 mr-2" /> Continue
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Step 4: Review & Activate ═══════════════════ */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Success banner */}
              <div className="p-6 text-center space-y-2">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">{sa.tenantReady}</h3>
                <p className="text-muted-foreground text-sm">Review the configuration below and activate.</p>
              </div>

              {/* Summary grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> {sa.ispName}</p>
                  <p className="font-medium">{tenantForm.name}</p>
                </div>
                <div className="p-3.5 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> {sa.subdomain}</p>
                  <p className="font-medium">{tenantForm.subdomain}.smartispapp.com</p>
                </div>
                <div className="p-3.5 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> {sa.customDomain}</p>
                  <p className="font-medium">{domainForm.domain || sa.notConfigured}</p>
                </div>
                <div className="p-3.5 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> {sa.plan}</p>
                  <p className="font-medium">{selectedPlan?.name || sa.notAssigned} ({planForm.billing_cycle})</p>
                </div>
                <div className="p-3.5 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Database className="h-3 w-3" /> {sa.dataImport}</p>
                  <p className="font-medium">{setupDoneCount}/{SETUP_ITEMS.length} completed</p>
                </div>
                <div className="p-3.5 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {sa.smsBalance}</p>
                  <p className="font-medium">{smsRecharge} credits</p>
                </div>
              </div>

              {/* SMS initial balance */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" /> {sa.initialSmsBalance}
                </Label>
                <div className="flex gap-2">
                  <Input type="number" value={smsRecharge} onChange={(e) => update({ smsRecharge: Number(e.target.value) })} min={0} className="max-w-[150px]" />
                  <div className="flex gap-1">
                    {[0, 100, 500, 1000].map((v) => (
                      <Button key={v} variant="outline" size="sm" onClick={() => update({ smsRecharge: v })}
                        className={smsRecharge === v ? "border-primary bg-primary/5" : ""}>
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {(!planForm.plan_id || !allSetupDone) && (
                <div className="space-y-2">
                  {!planForm.plan_id && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>No subscription plan assigned — billing features will be disabled</span>
                    </div>
                  )}
                  {!allSetupDone && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Data import incomplete — some features may not work until setup is finished</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => update({ step: 3 })} disabled={isPending}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button size="lg" onClick={() => activateTenant.mutate()} disabled={isPending} className="min-w-[200px]">
                  {activateTenant.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
                  {sa.activateTenant}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
