import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Loader2, RefreshCw, Router, Target, Wallet, CreditCard,
  TrendingUp, TrendingDown, ShoppingCart, AlertTriangle, DollarSign,
  Wifi, WifiOff, CircleDollarSign, TicketCheck, Package,
} from "lucide-react";
import api from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { toast } from "sonner";
import { useState, useMemo, useCallback } from "react";
import { format, subMonths } from "date-fns";
import { safeFormat } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import NotificationCenter from "@/components/NotificationCenter";
import StatCard from "@/components/dashboard/StatCard";
import PaymentSummaryCard from "@/components/dashboard/PaymentSummaryCard";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#6366f1"];

// ── Payment stats helper ──
function usePaymentStats(method: string) {
  const { data, isLoading } = useQuery({
    queryKey: [`${method}-dashboard-stats`],
    queryFn: async () => {
      const thirtyDaysAgo = format(subMonths(new Date(), 1), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("payments")
        .select("amount, status, paid_at, payment_method")
        .eq("payment_method", method)
        .gte("paid_at", `${thirtyDaysAgo}T00:00:00`);
      if (error) throw error;
      return data;
    },
  });

  return useMemo(() => {
    if (!data) return { loading: isLoading, todayAmount: 0, todayCount: 0, monthAmount: 0, monthCount: 0, completed: 0, pending: 0, failed: 0, refunded: 0, dailyData: [] as { day: string; amount: number }[] };
    const today = format(new Date(), "yyyy-MM-dd");
    const todayP = data.filter(p => p.paid_at?.startsWith(today) && p.status === "completed");
    const completedAll = data.filter(p => p.status === "completed");
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      dailyMap[format(dt, "yyyy-MM-dd")] = 0;
    }
    completedAll.forEach(p => { const d = p.paid_at?.substring(0, 10); if (d && dailyMap[d] !== undefined) dailyMap[d] += Number(p.amount); });
    return {
      loading: isLoading,
      todayAmount: todayP.reduce((s, p) => s + Number(p.amount), 0),
      todayCount: todayP.length,
      monthAmount: completedAll.reduce((s, p) => s + Number(p.amount), 0),
      monthCount: completedAll.length,
      completed: completedAll.length,
      pending: data.filter(p => p.status === "pending").length,
      failed: data.filter(p => p.status === "failed").length,
      refunded: data.filter(p => p.status === "refunded").length,
      dailyData: Object.entries(dailyMap).map(([day, amount]) => ({ day: safeFormat(day, "dd MMM", day), amount })),
    };
  }, [data, isLoading]);
}

export default function Dashboard() {
  const [runningBillControl, setRunningBillControl] = useState(false);
  const [refreshingMikrotik, setRefreshingMikrotik] = useState(false);

  // ── Core data queries ──
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
      const { data, error } = await supabase.from("bills").select("id, amount, status, month, created_at").gte("created_at", format(subMonths(new Date(), 5), "yyyy-MM-01"));
      if (error) throw error;
      return data;
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["tickets-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_tickets").select("id, status");
      if (error) throw error;
      return data;
    },
  });

  const { data: mikrotikStats, isLoading: loadingMikrotik, refetch: refetchMikrotik } = useQuery({
    queryKey: ["mikrotik-router-stats"],
    queryFn: async () => {
      const { data } = await api.post('/mikrotik/router-stats', {});
      return data as { total_online: number; total_suspended: number; routers: { name: string; online: number; suspended: number; error?: string }[] };
    },
    refetchInterval: 30000,
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: merchantPayments, isLoading: loadingMerchant } = useQuery({
    queryKey: ["merchant-payments-today", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase.from("merchant_payments").select("id, amount, status")
        .gte("created_at", `${todayStr}T00:00:00`).lte("created_at", `${todayStr}T23:59:59`);
      if (error) throw error;
      return data;
    },
  });

  // Accounting queries
  const { data: accSales = [] } = useQuery({ queryKey: ["acc-sales-dash"], queryFn: async () => { const { data } = await supabase.from("sales").select("*"); return data || []; } });
  const { data: accPurchases = [] } = useQuery({ queryKey: ["acc-purchases-dash"], queryFn: async () => { const { data } = await supabase.from("purchases").select("*"); return data || []; } });
  const { data: accExpenses = [] } = useQuery({ queryKey: ["acc-expenses-dash"], queryFn: async () => { const { data } = await supabase.from("expenses").select("*"); return data || []; } });
  const { data: accProducts = [] } = useQuery({ queryKey: ["acc-products-dash"], queryFn: async () => { const { data } = await supabase.from("products").select("*"); return data || []; } });

  const bkash = usePaymentStats("bkash");
  const nagad = usePaymentStats("nagad");

  // ── Derived calculations ──
  const total = customers?.length ?? 0;
  const active = customers?.filter(c => c.status === "active").length ?? 0;
  const suspended = customers?.filter(c => c.status === "suspended").length ?? 0;
  const onlineCount = loadingMikrotik ? 0 : (mikrotikStats?.total_online ?? 0);
  const offlineCount = total - onlineCount;
  const openTickets = tickets?.filter(t => t.status === "open" || t.status === "in_progress").length ?? 0;

  const currentMonth = format(new Date(), "yyyy-MM");
  const targetAmount = customers?.filter(c => c.status === "active").reduce((s, c) => s + Number(c.monthly_bill), 0) ?? 0;
  const collectedAmount = bills?.filter(b => b.month === currentMonth && b.status === "paid").reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const dueAmount = bills?.filter(b => b.month === currentMonth && b.status === "unpaid").reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const totalDue = bills?.filter(b => b.status === "unpaid").reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const monthlyRevenue = bills?.filter(b => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const collectionRate = targetAmount > 0 ? Math.round((collectedAmount / targetAmount) * 100) : 0;

  const merchantTotal = merchantPayments?.length ?? 0;
  const merchantMatched = merchantPayments?.filter(p => p.status === "matched").length ?? 0;
  const merchantAmount = merchantPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;

  const totalAccSales = accSales.reduce((s: number, x: any) => s + Number(x.total || 0), 0);
  const totalAccPurchases = accPurchases.reduce((s: number, x: any) => s + Number(x.total || 0), 0);
  const totalAccExpenses = accExpenses.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const netProfit = totalAccSales - totalAccPurchases - totalAccExpenses;
  const lowStockProducts = accProducts.filter((p: any) => Number(p.stock) <= 5 && Number(p.stock) >= 0);

  const revenueChartData = useMemo(() => {
    if (!bills) return [];
    const months: Record<string, { paid: number; due: number }> = {};
    for (let i = 5; i >= 0; i--) months[format(subMonths(new Date(), i), "yyyy-MM")] = { paid: 0, due: 0 };
    bills.forEach(b => { if (months[b.month]) { if (b.status === "paid") months[b.month].paid += Number(b.amount); else months[b.month].due += Number(b.amount); } });
    return Object.entries(months).map(([m, v]) => ({ month: safeFormat(m + "-01", "MMM yy", m), paid: v.paid, due: v.due }));
  }, [bills]);

  const accMonthlyData = useMemo(() => {
    const months: Record<string, { month: string; income: number; expense: number }> = {};
    accSales.forEach((s: any) => { const m = s.sale_date?.substring(0, 7) || "?"; if (!months[m]) months[m] = { month: m, income: 0, expense: 0 }; months[m].income += Number(s.total || 0); });
    accPurchases.forEach((p: any) => { const m = (p.date || p.purchase_date)?.substring(0, 7) || "?"; if (!months[m]) months[m] = { month: m, income: 0, expense: 0 }; months[m].expense += Number(p.total || 0); });
    accExpenses.forEach((e: any) => { const m = e.date?.substring(0, 7) || "?"; if (!months[m]) months[m] = { month: m, income: 0, expense: 0 }; months[m].expense += Number(e.amount || 0); });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [accSales, accPurchases, accExpenses]);

  const expenseByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    accExpenses.forEach((e: any) => { cats[e.category || "other"] = (cats[e.category || "other"] || 0) + Number(e.amount || 0); });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [accExpenses]);

  // ── Actions ──
  const handleRefreshMikrotik = useCallback(async () => {
    setRefreshingMikrotik(true);
    await refetchMikrotik();
    setRefreshingMikrotik(false);
    toast.success("MikroTik stats refreshed");
  }, [refetchMikrotik]);

  const runBillControl = async () => {
    setRunningBillControl(true);
    try {
      const { data } = await api.post('/mikrotik/bill-control', {});
      const r = data?.results;
      toast.success(`Bill control: ${r?.suspended || 0} suspended, ${r?.reactivated || 0} reactivated`);
    } catch (e: any) {
      toast.error("Bill control failed: " + (e.message || "Unknown error"));
    } finally {
      setRunningBillControl(false);
    }
  };

  if (loadingCustomers || loadingBills) {
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
      {/* ══════ Header ══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your ISP operations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshMikrotik} disabled={refreshingMikrotik || loadingMikrotik}>
            {refreshingMikrotik ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Refresh
          </Button>
          <Button size="sm" onClick={runBillControl} disabled={runningBillControl}>
            {runningBillControl ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Router className="h-3.5 w-3.5 mr-1.5" />}
            Bill Control
          </Button>
        </div>
      </div>

      {/* ══════ Section 1: Customer & Connection Stats ══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard title="Total Customers" value={total} icon={<Users className="h-5 w-5" />} variant="default" />
        <StatCard title="Active" value={active} icon={<Users className="h-5 w-5" />} variant="success" />
        <StatCard title="Suspended" value={suspended} icon={<Users className="h-5 w-5" />} variant="destructive" />
        <StatCard title="Online" value={loadingMikrotik ? "..." : onlineCount} icon={<Wifi className="h-5 w-5" />} variant="success" />
        <StatCard title="Offline" value={loadingMikrotik ? "..." : offlineCount} icon={<WifiOff className="h-5 w-5" />} variant="warning" />
        <StatCard title="Open Tickets" value={openTickets} icon={<TicketCheck className="h-5 w-5" />} variant="accent" />
      </div>

      {/* ══════ Section 2: Financial Overview ══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="This Month Income" value={`৳${collectedAmount.toLocaleString()}`} icon={<CircleDollarSign className="h-5 w-5" />} variant="success" />
        <StatCard title="This Month Due" value={`৳${dueAmount.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} variant="destructive" />
        <StatCard title="Total Due" value={`৳${totalDue.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} variant="warning" />
        <StatCard title="Total Revenue" value={`৳${monthlyRevenue.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} variant="default" />
      </div>

      {/* ══════ Section 3: Collection Progress + Revenue Chart ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Collection vs Target */}
        <Card className={`lg:col-span-2 border-border/50 ${collectionRate < 50 && targetAmount > 0 ? "border-destructive/30" : ""}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className={`h-4 w-4 ${collectionRate < 50 && targetAmount > 0 ? "text-destructive" : "text-primary"}`} />
              Collection Target — {format(new Date(), "MMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className={`text-2xl font-bold ${collectionRate < 50 && targetAmount > 0 ? "text-destructive" : "text-success"}`}>৳{collectedAmount.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="text-2xl font-bold text-foreground">৳{targetAmount.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <Progress value={collectionRate} className={`h-2.5 ${collectionRate < 50 && targetAmount > 0 ? "[&>div]:bg-destructive" : ""}`} />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{collectionRate}% collected</span>
                <span>৳{dueAmount.toLocaleString()} remaining</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
              <div className="text-center">
                <p className="text-lg font-bold text-success">{bills?.filter(b => b.month === currentMonth && b.status === "paid").length ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Paid</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-warning">{bills?.filter(b => b.month === currentMonth && b.status === "unpaid").length ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Unpaid</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{active}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-3 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Revenue Trend (6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No revenue data</p>
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`৳${v.toLocaleString()}`, undefined]} />
                    <Bar dataKey="paid" name="Collected" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="due" name="Due" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════ Section 4: Merchant + Router Health ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Merchant Payments */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Today's Merchant Payments
              </CardTitle>
              <span className="text-xs text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</span>
            </div>
          </CardHeader>
          <CardContent>
            {loadingMerchant ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : merchantTotal === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No merchant payments today</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Total", val: merchantTotal, cls: "bg-muted/50 text-foreground" },
                    { label: "Matched", val: merchantMatched, cls: "bg-success/10 text-success" },
                    { label: "Review", val: merchantPayments?.filter(p => p.status === "manual_review").length ?? 0, cls: "bg-warning/10 text-warning" },
                    { label: "Unmatched", val: merchantPayments?.filter(p => p.status === "unmatched").length ?? 0, cls: "bg-destructive/10 text-destructive" },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-3 text-center ${s.cls}`}>
                      <p className="text-2xl font-bold">{s.val}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-bold text-foreground">৳{merchantAmount.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Router Health */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Router className="h-4 w-4 text-primary" />
                Router Health
              </CardTitle>
              <span className="text-sm font-bold text-primary">
                {loadingMikrotik ? "..." : `${mikrotikStats?.routers?.filter(r => !r.error).length ?? 0}/${mikrotikStats?.routers?.length ?? 0}`}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {mikrotikStats?.routers && mikrotikStats.routers.length > 0 ? (
              <div className="space-y-2">
                {mikrotikStats.routers.map(r => (
                  <div key={r.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-sm text-foreground flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${r.error ? "bg-destructive animate-pulse" : "bg-success"}`} />
                      {r.name}
                    </span>
                    <span className={`text-xs font-medium ${r.error ? "text-destructive" : "text-success"}`}>
                      {r.error ? "Offline" : `${r.online} online`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No routers configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════ Section 5: Payment Gateways (bKash + Nagad) ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PaymentSummaryCard
          title="bKash Payments"
          icon={<CreditCard className="h-4 w-4 text-primary" />}
          chartColor="hsl(var(--primary))"
          chartLabel="bKash"
          {...bkash}
        />
        <PaymentSummaryCard
          title="Nagad Payments"
          icon={<Wallet className="h-4 w-4 text-accent" />}
          chartColor="hsl(var(--accent))"
          chartLabel="Nagad"
          {...nagad}
        />
      </div>

      {/* ══════ Section 6: Accounting Overview ══════ */}
      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Accounting Overview
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Sales" value={`৳${totalAccSales.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} variant="success" />
          <StatCard title="Total Purchases" value={`৳${totalAccPurchases.toLocaleString()}`} icon={<ShoppingCart className="h-5 w-5" />} variant="default" />
          <StatCard title="Total Expenses" value={`৳${totalAccExpenses.toLocaleString()}`} icon={<TrendingDown className="h-5 w-5" />} variant="destructive" />
          <StatCard title="Net Profit" value={`৳${netProfit.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} variant={netProfit >= 0 ? "success" : "destructive"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-base">Income vs Expense</CardTitle></CardHeader>
            <CardContent>
              {accMonthlyData.length > 0 ? (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accMonthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                      <Bar dataKey="income" fill="hsl(var(--primary))" name="Income" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="hsl(var(--destructive))" name="Expense" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-10">No data yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
            <CardContent>
              {expenseByCategory.length > 0 ? (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseByCategory} cx="50%" cy="50%" outerRadius={90} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-10">No expenses recorded</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <Card className="border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Low Stock Alerts ({lowStockProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.slice(0, 5).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{p.sku || "—"}</TableCell>
                        <TableCell className="text-right text-destructive font-bold">{p.stock}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ══════ Notification Center ══════ */}
      <NotificationCenter />
    </DashboardLayout>
  );
}
