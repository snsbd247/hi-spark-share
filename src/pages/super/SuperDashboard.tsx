import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CreditCard, AlertTriangle, TrendingUp, MessageSquare, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SuperDashboard() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const navigate = useNavigate();
  const { data: tenants = [], isLoading: tLoading } = useQuery({ queryKey: ["super-tenants"], queryFn: () => superAdminApi.getTenants({}) });
  const { data: subs = [] } = useQuery({ queryKey: ["super-subscriptions"], queryFn: () => superAdminApi.getSubscriptions({}) });
  const { data: wallets = [] } = useQuery({ queryKey: ["super-sms-wallets"], queryFn: superAdminApi.getSmsWallets });

  if (tLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{sa.dashboard}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const activeTenants = tenants.filter((t: any) => t.status === "active").length;
  const suspendedTenants = tenants.filter((t: any) => t.status === "suspended").length;
  const activeSubs = subs.filter((s: any) => s.status === "active");
  const totalRevenue = activeSubs.reduce((s: number, sub: any) => s + Number(sub.amount || 0), 0);
  const totalSmsBalance = wallets.reduce((s: number, w: any) => s + Number(w.balance || 0), 0);

  // Expiring soon (within 30 days)
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringSoon = subs.filter((s: any) => {
    const end = new Date(s.end_date);
    return s.status === "active" && end <= in30Days && end >= now;
  });

  // Tenants with incomplete setup
  const incompleteSetup = tenants.filter((t: any) => t.setup_status !== "completed");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/super/tenants")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeTenants} active · {suspendedTenants} suspended</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SMS Credits</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSmsBalance.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{expiringSoon.length + incompleteSetup.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{sa.needAttention}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(expiringSoon.length > 0 || incompleteSetup.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> {sa.alertsWarnings}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiringSoon.map((sub: any) => (
              <div key={sub.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{sub.tenant?.name || "—"} — Subscription expiring</p>
                  <p className="text-xs text-muted-foreground">{sub.plan?.name} · Expires {sub.end_date}</p>
                </div>
                <Badge variant="outline" className="text-destructive border-destructive/30">{sa.expiring}</Badge>
              </div>
            ))}
            {incompleteSetup.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-yellow-500/5 rounded-lg cursor-pointer" onClick={() => navigate(`/super/tenants/${t.id}`)}>
                <div>
                  <p className="font-medium text-sm">{t.name} — Setup incomplete</p>
                  <p className="text-xs text-muted-foreground">{t.subdomain}.smartispapp.com</p>
                </div>
                <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">{sa.setup}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{sa.recentTenants}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tenants.slice(0, 5).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => navigate(`/super/tenants/${t.id}`)}>
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.subdomain}.smartispapp.com</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.setup_status === "completed" ? (
                    <Activity className="h-4 w-4 text-primary" />
                  ) : (
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Badge variant={t.status === "active" ? "default" : t.status === "trial" ? "secondary" : "destructive"}>
                    {t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
