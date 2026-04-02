import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { Users, TrendingUp, TrendingDown, DollarSign, UserMinus, Target } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { useMemo } from "react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "#f59e0b", "#10b981", "#6366f1", "#ec4899"];

export default function AdvancedAnalytics() {
  const { data: customers = [] } = useQuery({
    queryKey: ["analytics-customers"],
    queryFn: async () => {
      const { data, error } = await db.from("customers").select("id, status, monthly_bill, created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["analytics-payments"],
    queryFn: async () => {
      const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
      const { data, error } = await db.from("payments").select("amount, paid_at, status").gte("paid_at", sixMonthsAgo);
      if (error) throw error;
      return data;
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["analytics-bills"],
    queryFn: async () => {
      const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-01");
      const { data, error } = await db.from("bills").select("amount, status, month, created_at").gte("month", sixMonthsAgo);
      if (error) throw error;
      return data;
    },
  });

  // Customer Growth Chart
  const customerGrowth = useMemo(() => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const m = format(subMonths(new Date(), i), "yyyy-MM");
      months[m] = 0;
    }
    customers.forEach((c: any) => {
      const m = c.created_at?.substring(0, 7);
      if (m && months[m] !== undefined) months[m]++;
    });
    let cumulative = customers.filter((c: any) => {
      const m = c.created_at?.substring(0, 7);
      return m && m < Object.keys(months)[0];
    }).length;
    return Object.entries(months).map(([month, count]) => {
      cumulative += count;
      return { month: format(new Date(month + "-01"), "MMM yy"), new: count, total: cumulative };
    });
  }, [customers]);

  // Revenue Trend
  const revenueTrend = useMemo(() => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) months[format(subMonths(new Date(), i), "yyyy-MM")] = 0;
    payments.filter((p: any) => p.status === "completed").forEach((p: any) => {
      const m = p.paid_at?.substring(0, 7);
      if (m && months[m] !== undefined) months[m] += Number(p.amount);
    });
    return Object.entries(months).map(([month, amount]) => ({ month: format(new Date(month + "-01"), "MMM yy"), revenue: amount }));
  }, [payments]);

  // Churn Rate
  const churnData = useMemo(() => {
    const total = customers.length;
    const left = customers.filter((c: any) => c.status === "left").length;
    const suspended = customers.filter((c: any) => c.status === "suspended").length;
    const churnRate = total > 0 ? ((left + suspended) / total * 100).toFixed(1) : "0";
    return { total, left, suspended, churnRate };
  }, [customers]);

  // ARPU
  const arpu = useMemo(() => {
    const active = customers.filter((c: any) => c.status === "active");
    const totalRevenue = payments.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + Number(p.amount), 0);
    return active.length > 0 ? Math.round(totalRevenue / active.length) : 0;
  }, [customers, payments]);

  // Status Distribution
  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    customers.forEach((c: any) => { dist[c.status] = (dist[c.status] || 0) + 1; });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [customers]);

  // Collection Rate by Month
  const collectionRate = useMemo(() => {
    const months: Record<string, { billed: number; collected: number }> = {};
    for (let i = 5; i >= 0; i--) months[format(subMonths(new Date(), i), "yyyy-MM")] = { billed: 0, collected: 0 };
    bills.forEach((b: any) => {
      if (months[b.month]) {
        months[b.month].billed += Number(b.amount);
        if (b.status === "paid") months[b.month].collected += Number(b.amount);
      }
    });
    return Object.entries(months).map(([month, v]) => ({
      month: format(new Date(month + "-01"), "MMM yy"),
      rate: v.billed > 0 ? Math.round((v.collected / v.billed) * 100) : 0,
    }));
  }, [bills]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Advanced Analytics</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Total Customers" value={customers.length} icon={<Users className="h-5 w-5" />} variant="default" />
          <StatCard title="ARPU" value={`৳${arpu.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} variant="success" />
          <StatCard title="Churn Rate" value={`${churnData.churnRate}%`} icon={<UserMinus className="h-5 w-5" />} variant={Number(churnData.churnRate) > 10 ? "destructive" : "warning"} />
          <StatCard title="Active" value={customers.filter((c: any) => c.status === "active").length} icon={<Target className="h-5 w-5" />} variant="success" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Customer Growth</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Total" />
                  <Bar dataKey="new" fill="hsl(var(--accent))" name="New" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Revenue Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Customer Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Collection Rate (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={collectionRate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Churn Details */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserMinus className="h-4 w-4" /> Churn Analysis</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{churnData.total}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-amber-500">{churnData.suspended}</p>
                <p className="text-xs text-muted-foreground">Suspended</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-destructive">{churnData.left}</p>
                <p className="text-xs text-muted-foreground">Left</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className={`text-2xl font-bold ${Number(churnData.churnRate) > 10 ? "text-destructive" : "text-green-600"}`}>{churnData.churnRate}%</p>
                <p className="text-xs text-muted-foreground">Churn Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
