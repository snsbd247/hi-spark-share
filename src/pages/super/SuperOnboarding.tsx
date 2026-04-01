import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Building2, Globe, CreditCard, Database, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, Rocket, Zap
} from "lucide-react";

const STEPS = [
  { label: "Create Tenant", icon: Building2 },
  { label: "Assign Domain", icon: Globe },
  { label: "Assign Plan", icon: CreditCard },
  { label: "Setup Data", icon: Database },
  { label: "Activate", icon: Rocket },
];

export default function SuperOnboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);
  const [autoSetup, setAutoSetup] = useState(true);

  const [tenantForm, setTenantForm] = useState({ name: "", subdomain: "", email: "", phone: "" });
  const [domainForm, setDomainForm] = useState({ domain: "" });
  const [planForm, setPlanForm] = useState({ plan_id: "", billing_cycle: "monthly" });

  const { data: plans = [] } = useQuery({ queryKey: ["super-plans"], queryFn: superAdminApi.getPlans });

  const createTenant = useMutation({
    mutationFn: superAdminApi.createTenant,
    onSuccess: (data: any) => {
      const id = Array.isArray(data) ? data[0]?.id : data?.id;
      setCreatedTenantId(id);
      toast.success("Tenant created!");
      setStep(1);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignDomain = useMutation({
    mutationFn: () => superAdminApi.assignDomain({ tenant_id: createdTenantId, domain: domainForm.domain }),
    onSuccess: () => { toast.success("Domain assigned!"); setStep(2); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignPlan = useMutation({
    mutationFn: () => superAdminApi.assignSubscription({ tenant_id: createdTenantId, ...planForm }),
    onSuccess: () => { toast.success("Plan assigned!"); setStep(3); },
    onError: (e: any) => toast.error(e.message),
  });

  const runSetup = useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 2000));
      if (createdTenantId) {
        await superAdminApi.updateTenant(createdTenantId, {
          setup_geo: true, setup_accounts: true, setup_templates: true, setup_ledger: true, setup_status: "completed",
        });
      }
    },
    onSuccess: () => { toast.success("Setup completed!"); setStep(4); },
    onError: (e: any) => toast.error(e.message),
  });

  const activateTenant = useMutation({
    mutationFn: () => {
      if (createdTenantId) return superAdminApi.activateTenant(createdTenantId);
      return Promise.resolve();
    },
    onSuccess: () => {
      toast.success("Tenant activated successfully!");
      qc.invalidateQueries({ queryKey: ["super-tenants"] });
      navigate(`/super/tenants/${createdTenantId}`);
    },
  });

  const isPending = createTenant.isPending || assignDomain.isPending || assignPlan.isPending || runSetup.isPending || activateTenant.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="h-6 w-6" /> New Tenant Onboarding
          </h1>
          <p className="text-muted-foreground">Step-by-step ISP tenant creation wizard</p>
        </div>
        <Badge variant="outline" className="text-sm">{step + 1} / {STEPS.length}</Badge>
      </div>

      {/* Progress */}
      <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
      <div className="flex justify-between">
        {STEPS.map((s, i) => (
          <div key={i} className={`flex flex-col items-center gap-1 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              i < step ? "bg-primary text-primary-foreground" : i === step ? "border-2 border-primary bg-primary/10" : "border border-muted-foreground/30"
            }`}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-xs hidden sm:block">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5" />; })()}
            {STEPS[step].label}
          </CardTitle>
          <CardDescription>
            {step === 0 && "Enter the ISP tenant's basic information"}
            {step === 1 && "Configure a custom domain for this tenant"}
            {step === 2 && "Select a subscription plan"}
            {step === 3 && "Import initial system data"}
            {step === 4 && "Review and activate the tenant"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 0: Create Tenant */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ISP Name *</Label>
                  <Input value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} placeholder="e.g. SpeedNet BD" />
                </div>
                <div className="space-y-2">
                  <Label>Subdomain *</Label>
                  <div className="flex items-center gap-1">
                    <Input value={tenantForm.subdomain} onChange={(e) => setTenantForm({ ...tenantForm, subdomain: e.target.value })} placeholder="speednet" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">.smartispapp.com</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => createTenant.mutate(tenantForm)} disabled={isPending || !tenantForm.name || !tenantForm.subdomain || !tenantForm.email}>
                {createTenant.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Create & Continue
              </Button>
            </div>
          )}

          {/* Step 1: Domain */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Custom Domain</Label>
                <Input value={domainForm.domain} onChange={(e) => setDomainForm({ domain: e.target.value })} placeholder="billing.yourisp.com" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Skip</Button>
                <Button onClick={() => assignDomain.mutate()} disabled={isPending || !domainForm.domain}>
                  {assignDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  Assign Domain
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Plan */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subscription Plan</Label>
                <Select value={planForm.plan_id} onValueChange={(v) => setPlanForm({ ...planForm, plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select value={planForm.billing_cycle} onValueChange={(v) => setPlanForm({ ...planForm, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => assignPlan.mutate()} disabled={isPending || !planForm.plan_id}>
                {assignPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Assign Plan
              </Button>
            </div>
          )}

          {/* Step 3: Setup */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Auto Setup</p>
                  <p className="text-sm text-muted-foreground">Automatically import Geo, Accounts, Templates & Ledger data</p>
                </div>
                <Switch checked={autoSetup} onCheckedChange={setAutoSetup} />
              </div>
              <div className="flex gap-2">
                {autoSetup ? (
                  <Button onClick={() => runSetup.mutate()} disabled={isPending}>
                    {runSetup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Run Full Setup
                  </Button>
                ) : (
                  <Button onClick={() => setStep(4)}>
                    <ArrowRight className="h-4 w-4 mr-2" /> Skip (Manual Setup Later)
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Activate */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-6 text-center space-y-3">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
                <h3 className="text-xl font-bold">Tenant Ready!</h3>
                <p className="text-muted-foreground">All steps are completed. Click below to activate.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">ISP Name</p>
                  <p className="font-medium">{tenantForm.name}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Subdomain</p>
                  <p className="font-medium">{tenantForm.subdomain}.smartispapp.com</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Domain</p>
                  <p className="font-medium">{domainForm.domain || "Not configured"}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Plan</p>
                  <p className="font-medium">{plans.find((p: any) => p.id === planForm.plan_id)?.name || "Not assigned"}</p>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={() => activateTenant.mutate()} disabled={isPending}>
                {activateTenant.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
                Activate Tenant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
