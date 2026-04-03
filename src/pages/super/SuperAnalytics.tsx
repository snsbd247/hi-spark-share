import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
import { useLanguage } from "@/contexts/LanguageContext";
  Building2, Users, CreditCard, TrendingUp, MessageSquare,
  Activity, CheckCircle2, AlertTriangle, Globe, BarChart3
} from "lucide-react";

export default function SuperAnalytics() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const { data: tenants = [], isLoading: tLoading } = useQuery({ queryKey: ["super-tenants"], queryFn: () => superAdminApi.getTenants({}) });
  const { data: plans = [] } = useQuery({ queryKey: ["super-plans"], queryFn: superAdminApi.getPlans });
  const { data: subs = [] } = useQuery({ queryKey: ["super-subscriptions"], queryFn: () => superAdminApi.getSubscriptions({}) });
  const { data: wallets = [] } = useQuery({ queryKey: ["super-sms-wallets"], queryFn: superAdminApi.getSmsWallets });
  const { data: domains = [] } = useQuery({ queryKey: ["super-domains"], queryFn: superAdminApi.getDomains });

  if (tLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  const activeTenants = tenants.filter((t: any) => t.status === "active").length;
  const suspendedTenants = tenants.filter((t: any) => t.status === "suspended").length;
  const activeSubs = subs.filter((s: any) => s.status === "active").length;
  const totalRevenue = subs.reduce((s: number, sub: any) => s + Number(sub.amount || 0), 0);
  const totalSmsBalance = wallets.reduce((s: number, w: any) => s + Number(w.balance || 0), 0);
  const setupComplete = tenants.filter((t: any) => t.setup_status === "completed").length;
  const verifiedDomains = domains.filter((d: any) => d.is_verified).length;

  // Plan distribution
  const planDist = plans.map((p: any) => ({
    name: p.name,
    count: subs.filter((s: any) => s.plan_id === p.id && s.status === "active").length,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <BarChart3 className="h-6 w-6" /> {sa.analyticsDashboard}
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Tenants</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tenants.length}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="default" className="text-xs">{activeTenants} active</Badge>
              {suspendedTenants > 0 && <Badge variant="destructive" className="text-xs">{suspendedTenants} suspended</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">৳{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeSubs} active subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">SMS Credits</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalSmsBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">across {wallets.length} tenants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Domains</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{domains.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{verifiedDomains} verified</p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution */}
      <Card>
        <CardHeader><CardTitle className="text-lg">{sa.planDistribution}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {planDist.map((p) => (
            <div key={p.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="font-medium">{p.count} tenants</span>
              </div>
              <Progress value={tenants.length > 0 ? (p.count / tenants.length) * 100 : 0} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tenant Health Overview */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5" /> {sa.tenantHealthOverview}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tenants.map((t: any) => {
              const sub = subs.find((s: any) => s.tenant_id === t.id);
              const wallet = wallets.find((w: any) => w.tenant_id === t.id);
              const domain = domains.find((d: any) => d.tenant_id === t.id);
              const isSetup = t.setup_status === "completed";
              const hasSub = sub?.status === "active";
              const hasSms = (wallet?.balance || 0) > 0;
              const hasDomain = !!domain;
              const healthScore = [isSetup, hasSub, hasSms, hasDomain].filter(Boolean).length;

              return (
                <div key={t.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${healthScore >= 3 ? "bg-primary" : healthScore >= 2 ? "bg-yellow-500" : "bg-destructive"}`} />
                    <div>
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.subdomain}.smartispapp.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span title="Setup">{isSetup ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-yellow-600" />}</span>
                    <span title="Subscription">{hasSub ? <CreditCard className="h-4 w-4 text-primary" /> : <CreditCard className="h-4 w-4 text-muted-foreground" />}</span>
                    <span title="SMS">{hasSms ? <MessageSquare className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4 text-muted-foreground" />}</span>
                    <span title="Domain">{hasDomain ? <Globe className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-muted-foreground" />}</span>
                    <Badge variant={t.status === "active" ? "default" : "destructive"} className="text-xs ml-2">{t.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
