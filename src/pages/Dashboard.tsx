import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, UserCheck, UserX, DollarSign, AlertCircle, Loader2, Wifi, WifiOff, RefreshCw, Wallet, Target, AlertTriangle, Send, Mail, CreditCard, Router } from "lucide-react";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { toast } from "sonner";
import { useState, useMemo, useEffect, useCallback } from "react";
import { format, subMonths } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Progress } from "@/components/ui/progress";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function StatCard({ title, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <Card className="glass-card animate-fade-in">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1 text-card-foreground">{value}</p>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${bgColor}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Monthly revenue data query - last 6 months
function useMonthlyRevenue() {
  return useQuery({
    queryKey: ["monthly-revenue"],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 5);
      const { data, error } = await supabase
        .from("bills")
        .select("amount, status, month")
        .gte("created_at", format(sixMonthsAgo, "yyyy-MM-01"));
      if (error) throw error;
      return data;
    },
  });
}

export default function Dashboard() {
  const [runningBillControl, setRunningBillControl] = useState(false);
  const [sendingAlert, setSendingAlert] = useState<"sms" | "email" | null>(null);
  const [alertShown, setAlertShown] = useState(false);

  // MikroTik real-time stats
  const [refreshingMikrotik, setRefreshingMikrotik] = useState(false);
  const { data: mikrotikStats, isLoading: loadingMikrotik, refetch: refetchMikrotik } = useQuery({
    queryKey: ["mikrotik-router-stats"],
    queryFn: async () => {
      const { data, error } = await supabaseClient.functions.invoke("mikrotik-sync/router-stats", { body: {} });
      if (error) throw error;
      return data as { total_online: number; total_suspended: number; routers: { name: string; online: number; suspended: number; error?: string }[] };
    },
    refetchInterval: 30000,
  });

  const handleRefreshMikrotik = useCallback(async () => {
    setRefreshingMikrotik(true);
    await refetchMikrotik();
    setRefreshingMikrotik(false);
    toast.success("MikroTik stats refreshed");
  }, [refetchMikrotik]);

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["customers-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, status, monthly_bill, connection_status");
      if (error) throw error;
      return data;
    },
  });

  const { data: bills, isLoading: loadingBills } = useQuery({
    queryKey: ["bills-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("id, amount, status");
      if (error) throw error;
      return data;
    },
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: merchantPayments, isLoading: loadingMerchant } = useQuery({
    queryKey: ["merchant-payments-today", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_payments")
        .select("id, amount, status")
        .gte("created_at", `${todayStr}T00:00:00`)
        .lte("created_at", `${todayStr}T23:59:59`);
      if (error) throw error;
      return data;
    },
  });

  // bKash payment collection summary
  const { data: bkashPayments, isLoading: loadingBkash } = useQuery({
    queryKey: ["bkash-dashboard-stats"],
    queryFn: async () => {
      const thirtyDaysAgo = format(subMonths(new Date(), 1), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("payments")
        .select("amount, status, paid_at, payment_method")
        .eq("payment_method", "bkash")
        .gte("paid_at", `${thirtyDaysAgo}T00:00:00`);
      if (error) throw error;
      return data;
    },
  });

  // Nagad payment collection summary
  const { data: nagadPayments, isLoading: loadingNagad } = useQuery({
    queryKey: ["nagad-dashboard-stats"],
    queryFn: async () => {
      const thirtyDaysAgo = format(subMonths(new Date(), 1), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("payments")
        .select("amount, status, paid_at, payment_method")
        .eq("payment_method", "nagad")
        .gte("paid_at", `${thirtyDaysAgo}T00:00:00`);
      if (error) throw error;
      return data;
    },
  });

  const bkashStats = useMemo(() => {
    if (!bkashPayments) return { todayAmount: 0, todayCount: 0, monthAmount: 0, monthCount: 0, completed: 0, pending: 0, failed: 0, refunded: 0, dailyData: [] as { day: string; amount: number }[] };

    const today = format(new Date(), "yyyy-MM-dd");
    const todayPayments = bkashPayments.filter(p => p.paid_at?.startsWith(today) && p.status === "completed");
    const completedAll = bkashPayments.filter(p => p.status === "completed");

    // Daily breakdown for last 7 days
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subMonths(new Date(), 0).setDate(new Date().getDate() - i) ? new Date(new Date().setDate(new Date().getDate() - i)) : new Date(), "yyyy-MM-dd");
      dailyMap[d] = 0;
    }
    completedAll.forEach(p => {
      const d = p.paid_at?.substring(0, 10);
      if (d && dailyMap[d] !== undefined) dailyMap[d] += Number(p.amount);
    });

    return {
      todayAmount: todayPayments.reduce((s, p) => s + Number(p.amount), 0),
      todayCount: todayPayments.length,
      monthAmount: completedAll.reduce((s, p) => s + Number(p.amount), 0),
      monthCount: completedAll.length,
      completed: completedAll.length,
      pending: bkashPayments.filter(p => p.status === "pending").length,
      failed: bkashPayments.filter(p => p.status === "failed").length,
      refunded: bkashPayments.filter(p => p.status === "refunded").length,
      dailyData: Object.entries(dailyMap).map(([day, amount]) => ({
        day: format(new Date(day), "dd MMM"),
        amount,
      })),
    };
  }, [bkashPayments]);

  const nagadStats = useMemo(() => {
    if (!nagadPayments) return { todayAmount: 0, todayCount: 0, monthAmount: 0, monthCount: 0, completed: 0, pending: 0, failed: 0, refunded: 0, dailyData: [] as { day: string; amount: number }[] };

    const today = format(new Date(), "yyyy-MM-dd");
    const todayPayments = nagadPayments.filter(p => p.paid_at?.startsWith(today) && p.status === "completed");
    const completedAll = nagadPayments.filter(p => p.status === "completed");

    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(new Date(new Date().setDate(new Date().getDate() - i)), "yyyy-MM-dd");
      dailyMap[d] = 0;
    }
    completedAll.forEach(p => {
      const d = p.paid_at?.substring(0, 10);
      if (d && dailyMap[d] !== undefined) dailyMap[d] += Number(p.amount);
    });

    return {
      todayAmount: todayPayments.reduce((s, p) => s + Number(p.amount), 0),
      todayCount: todayPayments.length,
      monthAmount: completedAll.reduce((s, p) => s + Number(p.amount), 0),
      monthCount: completedAll.length,
      completed: completedAll.length,
      pending: nagadPayments.filter(p => p.status === "pending").length,
      failed: nagadPayments.filter(p => p.status === "failed").length,
      refunded: nagadPayments.filter(p => p.status === "refunded").length,
      dailyData: Object.entries(dailyMap).map(([day, amount]) => ({
        day: format(new Date(day), "dd MMM"),
        amount,
      })),
    };
  }, [nagadPayments]);

  const isLoading = loadingCustomers || loadingBills;

  const total = customers?.length ?? 0;
  const active = customers?.filter((c) => c.status === "active").length ?? 0;
  const suspended = customers?.filter((c) => c.status === "suspended").length ?? 0;
  const onlineUsers = customers?.filter((c) => c.connection_status === "active").length ?? 0;
  const suspendedConn = customers?.filter((c) => c.connection_status === "suspended").length ?? 0;
  const monthlyRevenue = bills?.filter((b) => b.status === "paid").reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;
  const totalDue = bills?.filter((b) => b.status === "unpaid").reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;

  const merchantTotal = merchantPayments?.length ?? 0;
  const merchantMatched = merchantPayments?.filter((p) => p.status === "matched").length ?? 0;
  const merchantReview = merchantPayments?.filter((p) => p.status === "manual_review").length ?? 0;
  const merchantUnmatched = merchantPayments?.filter((p) => p.status === "unmatched").length ?? 0;
  const merchantAmount = merchantPayments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const { data: revenueBills } = useMonthlyRevenue();

  const revenueChartData = useMemo(() => {
    if (!revenueBills) return [];
    const months: Record<string, { paid: number; due: number }> = {};
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const m = format(subMonths(new Date(), i), "yyyy-MM");
      months[m] = { paid: 0, due: 0 };
    }
    revenueBills.forEach((b) => {
      const m = b.month;
      if (months[m]) {
        if (b.status === "paid") months[m].paid += Number(b.amount);
        else months[m].due += Number(b.amount);
      }
    });
    return Object.entries(months).map(([month, vals]) => ({
      month: format(new Date(month + "-01"), "MMM yy"),
      paid: vals.paid,
      due: vals.due,
    }));
  }, [revenueBills]);

  // Collection vs Target calculations
  const currentMonth = format(new Date(), "yyyy-MM");
  const targetAmount = customers?.filter((c) => c.status === "active").reduce((sum, c) => sum + Number(c.monthly_bill), 0) ?? 0;
  const collectedAmount = revenueBills?.filter((b) => b.month === currentMonth && b.status === "paid").reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;
  const dueAmount = revenueBills?.filter((b) => b.month === currentMonth && b.status === "unpaid").reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;
  const collectionRate = targetAmount > 0 ? Math.round((collectedAmount / targetAmount) * 100) : 0;
  const isLowCollection = targetAmount > 0 && collectionRate < 50;

  // In-app toast notification for low collection
  useEffect(() => {
    if (isLowCollection && !alertShown && !isLoading) {
      toast.warning(`⚠️ Collection rate is only ${collectionRate}% — below 50% threshold!`, { duration: 8000 });
      setAlertShown(true);
    }
  }, [isLowCollection, collectionRate, alertShown, isLoading]);

  const sendCollectionAlert = useCallback(async (channel: "sms" | "email") => {
    setSendingAlert(channel);
    try {
      const { data: settings } = await supabase.from("general_settings").select("*").limit(1).single();
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").single();
      
      const alertMessage = `⚠️ Low Collection Alert!\n\nMonth: ${format(new Date(), "MMMM yyyy")}\nCollection Rate: ${collectionRate}%\nCollected: Tk ${collectedAmount.toLocaleString()} / Target: Tk ${targetAmount.toLocaleString()}\nRemaining Due: Tk ${dueAmount.toLocaleString()}\n\n— ${settings?.site_name || "Smart ISP"}`;

      if (channel === "sms") {
        const adminPhone = profile?.mobile || settings?.mobile;
        if (!adminPhone) { toast.error("No admin phone number configured in profile or general settings"); return; }
        const { error } = await supabase.functions.invoke("send-sms", {
          body: { to: adminPhone, message: alertMessage, sms_type: "collection_alert" },
        });
        if (error) throw error;
        toast.success("SMS alert sent to " + adminPhone);
      } else {
        const adminEmail = profile?.email || settings?.email;
        if (!adminEmail) { toast.error("No admin email configured in profile or general settings"); return; }
        // Send email via send-sms edge function won't work for email, 
        // so we'll use a simple notification approach
        toast.info(`📧 Email alert would be sent to ${adminEmail}.\nTo enable email sending, set up a custom email domain in Cloud → Email settings.`);
      }
    } catch (e: any) {
      toast.error(`Failed to send ${channel} alert: ${e.message}`);
    } finally {
      setSendingAlert(null);
    }
  }, [collectionRate, collectedAmount, targetAmount, dueAmount]);

  const runBillControl = async () => {
    setRunningBillControl(true);
    try {
      const { data, error } = await supabase.functions.invoke("mikrotik-sync/bill-control", { body: {} });
      if (error) throw error;
      const r = data?.results;
      toast.success(`Bill control completed: ${r?.suspended || 0} suspended, ${r?.reactivated || 0} reactivated`);
    } catch (e: any) {
      toast.error("Bill control failed: " + (e.message || "Unknown error"));
    } finally {
      setRunningBillControl(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to Smart ISP Admin Panel</p>
        </div>
        <Button variant="outline" onClick={runBillControl} disabled={runningBillControl} className="w-full sm:w-auto">
          {runningBillControl ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run Bill Control
        </Button>
      </div>

      {/* Low Collection Rate Alert Banner */}
      {isLowCollection && (
        <Alert variant="destructive" className="mb-6 border-destructive/50 bg-destructive/5">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-base">Low Collection Rate Warning</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
            <span className="text-sm">
              Collection is at <strong>{collectionRate}%</strong> — only ৳{collectedAmount.toLocaleString()} collected out of ৳{targetAmount.toLocaleString()} target for {format(new Date(), "MMMM yyyy")}.
            </span>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/30 hover:bg-destructive/10"
                onClick={() => sendCollectionAlert("sms")}
                disabled={sendingAlert !== null}
              >
                {sendingAlert === "sms" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                SMS Alert
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/30 hover:bg-destructive/10"
                onClick={() => sendCollectionAlert("email")}
                disabled={sendingAlert !== null}
              >
                {sendingAlert === "email" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                Email Alert
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Customers" value={total} icon={Users} color="text-primary" bgColor="bg-primary/10" />
        <StatCard title="Active Customers" value={active} icon={UserCheck} color="text-success" bgColor="bg-success/10" />
        <StatCard title="Suspended" value={suspended} icon={UserX} color="text-destructive" bgColor="bg-destructive/10" />
        <StatCard title="Monthly Revenue" value={`৳${monthlyRevenue.toLocaleString()}`} icon={DollarSign} color="text-accent" bgColor="bg-accent/10" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Online Users" value={onlineUsers} icon={Wifi} color="text-success" bgColor="bg-success/10" />
        <StatCard title="Suspended Connections" value={suspendedConn} icon={WifiOff} color="text-destructive" bgColor="bg-destructive/10" />
        <StatCard title="Total Due" value={`৳${totalDue.toLocaleString()}`} icon={AlertCircle} color="text-warning" bgColor="bg-warning/10" />
      </div>

      {/* MikroTik Real-Time Stats */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Router className="h-5 w-5 text-primary" /> MikroTik Live Stats
        </h2>
        <Button variant="outline" size="sm" onClick={handleRefreshMikrotik} disabled={refreshingMikrotik || loadingMikrotik}>
          {refreshingMikrotik ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card className="glass-card animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Online Users</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1 text-card-foreground">
                  {loadingMikrotik ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline" /> : mikrotikStats?.total_online ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Active PPPoE sessions</p>
              </div>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-success/10">
                <Wifi className="h-6 w-6 text-success" />
              </div>
            </div>
            {mikrotikStats?.routers && mikrotikStats.routers.length > 1 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {mikrotikStats.routers.map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Router className="h-3 w-3" /> {r.name}
                    </span>
                    {r.error ? (
                      <span className="text-destructive">Offline</span>
                    ) : (
                      <span className="text-foreground font-medium">{r.online}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Suspended Users</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1 text-card-foreground">
                  {loadingMikrotik ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline" /> : mikrotikStats?.total_suspended ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Disabled PPP secrets</p>
              </div>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-destructive/10">
                <WifiOff className="h-6 w-6 text-destructive" />
              </div>
            </div>
            {mikrotikStats?.routers && mikrotikStats.routers.length > 1 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {mikrotikStats.routers.map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Router className="h-3 w-3" /> {r.name}
                    </span>
                    {r.error ? (
                      <span className="text-destructive">Offline</span>
                    ) : (
                      <span className="text-foreground font-medium">{r.suspended}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Router Health Indicator */}
        <Card className="glass-card animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Router Health</p>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary/10">
                <Router className="h-6 w-6 text-primary" />
              </div>
            </div>
            {loadingMikrotik ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : mikrotikStats?.routers && mikrotikStats.routers.length > 0 ? (
              <div className="space-y-2.5">
                {mikrotikStats.routers.map((r) => (
                  <div key={r.name} className="flex items-center justify-between">
                    <span className="text-sm text-foreground flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${r.error ? "bg-destructive animate-pulse" : "bg-success"}`} />
                      {r.name}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.error ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                      {r.error ? "Offline" : "Online"}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                  {mikrotikStats.routers.filter(r => !r.error).length}/{mikrotikStats.routers.length} routers online
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No routers configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card animate-fade-in mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Monthly Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No revenue data available</p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => [`৳${value.toLocaleString()}`, undefined]}
                  />
                  <Bar dataKey="paid" name="Collected" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="due" name="Due" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Collection vs Target Widget */}
      <Card className={`glass-card animate-fade-in mb-6 ${isLowCollection ? "border-destructive/30" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className={`h-5 w-5 ${isLowCollection ? "text-destructive" : "text-primary"}`} />
            Monthly Collection vs Target
            {isLowCollection && (
              <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Below 50%</span>
            )}
            <span className="text-sm font-normal text-muted-foreground ml-auto">{format(new Date(), "MMMM yyyy")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className={`text-2xl font-bold ${isLowCollection ? "text-destructive" : "text-success"}`}>৳{collectedAmount.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Target</p>
                <p className="text-2xl font-bold text-foreground">৳{targetAmount.toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Progress value={collectionRate} className={`h-3 ${isLowCollection ? "[&>div]:bg-destructive" : ""}`} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className={isLowCollection ? "text-destructive font-medium" : ""}>{collectionRate}% collected</span>
                <span>৳{dueAmount.toLocaleString()} remaining</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
              <div className="text-center">
                <p className="text-lg font-bold text-success">{revenueBills?.filter((b) => b.month === currentMonth && b.status === "paid").length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Paid Bills</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-warning">{revenueBills?.filter((b) => b.month === currentMonth && b.status === "unpaid").length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Unpaid Bills</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{active}</p>
                <p className="text-xs text-muted-foreground">Active Customers</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Merchant Payments Today Widget */}
      <Card className="glass-card animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Today's Merchant Payments
            </CardTitle>
            <span className="text-sm text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMerchant ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : merchantTotal === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No merchant payments received today</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{merchantTotal}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg bg-success/10 p-3 text-center">
                  <p className="text-2xl font-bold text-success">{merchantMatched}</p>
                  <p className="text-xs text-muted-foreground">Matched</p>
                </div>
                <div className="rounded-lg bg-warning/10 p-3 text-center">
                  <p className="text-2xl font-bold text-warning">{merchantReview}</p>
                  <p className="text-xs text-muted-foreground">Review</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{merchantUnmatched}</p>
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="text-lg font-bold text-foreground">৳{merchantAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* bKash Payment Collection Summary */}
      <Card className="glass-card animate-fade-in mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              bKash Payment Summary
            </CardTitle>
            <span className="text-sm text-muted-foreground">Last 30 days</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBkash ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Today vs Month Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Today</p>
                  <p className="text-2xl font-bold text-foreground">৳{bkashStats.todayAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{bkashStats.todayCount} transaction{bkashStats.todayCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">This Month</p>
                  <p className="text-2xl font-bold text-foreground">৳{bkashStats.monthAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{bkashStats.monthCount} transaction{bkashStats.monthCount !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg bg-success/10 p-3 text-center">
                  <p className="text-xl font-bold text-success">{bkashStats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="rounded-lg bg-warning/10 p-3 text-center">
                  <p className="text-xl font-bold text-warning">{bkashStats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3 text-center">
                  <p className="text-xl font-bold text-destructive">{bkashStats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{bkashStats.refunded}</p>
                  <p className="text-xs text-muted-foreground">Refunded</p>
                </div>
              </div>

              {/* Daily Chart */}
              {bkashStats.dailyData.length > 0 && (
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bkashStats.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number) => [`৳${value.toLocaleString()}`, "bKash"]}
                      />
                      <Bar dataKey="amount" name="bKash" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nagad Payment Collection Summary */}
      <Card className="glass-card animate-fade-in mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Nagad Payment Summary
            </CardTitle>
            <span className="text-sm text-muted-foreground">Last 30 days</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingNagad ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Today</p>
                  <p className="text-2xl font-bold text-foreground">৳{nagadStats.todayAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{nagadStats.todayCount} transaction{nagadStats.todayCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">This Month</p>
                  <p className="text-2xl font-bold text-foreground">৳{nagadStats.monthAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{nagadStats.monthCount} transaction{nagadStats.monthCount !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg bg-success/10 p-3 text-center">
                  <p className="text-xl font-bold text-success">{nagadStats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="rounded-lg bg-warning/10 p-3 text-center">
                  <p className="text-xl font-bold text-warning">{nagadStats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3 text-center">
                  <p className="text-xl font-bold text-destructive">{nagadStats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{nagadStats.refunded}</p>
                  <p className="text-xs text-muted-foreground">Refunded</p>
                </div>
              </div>

              {nagadStats.dailyData.length > 0 && (
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nagadStats.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number) => [`৳${value.toLocaleString()}`, "Nagad"]}
                      />
                      <Bar dataKey="amount" name="Nagad" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}