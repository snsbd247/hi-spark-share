import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Wallet, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const COLORS = {
  matched: "hsl(var(--success))",
  manual_review: "hsl(var(--warning))",
  unmatched: "hsl(var(--muted-foreground))",
  rejected: "hsl(var(--destructive))",
};

const PIE_COLORS = ["#22c55e", "#f59e0b", "#94a3b8", "#ef4444"];

type Period = "7days" | "30days" | "this_week" | "this_month";

export default function MerchantPaymentReports() {
  const [period, setPeriod] = useState<Period>("30days");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "7days":
        return { from: subDays(now, 6), to: now };
      case "30days":
        return { from: subDays(now, 29), to: now };
      case "this_week":
        return { from: startOfWeek(now, { weekStartsOn: 6 }), to: endOfWeek(now, { weekStartsOn: 6 }) };
      case "this_month":
        return { from: startOfMonth(now), to: endOfMonth(now) };
    }
  }, [period]);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["merchant-report", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_payments")
        .select("id, amount, status, created_at, transaction_id")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Daily bar chart data
  const dailyData = useMemo(() => {
    if (!payments) return [];
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayPayments = payments.filter((p) => p.created_at.startsWith(dayStr));
      return {
        date: format(day, "dd MMM"),
        matched: dayPayments.filter((p) => p.status === "matched").reduce((s, p) => s + Number(p.amount), 0),
        review: dayPayments.filter((p) => p.status === "manual_review").reduce((s, p) => s + Number(p.amount), 0),
        unmatched: dayPayments.filter((p) => p.status === "unmatched").reduce((s, p) => s + Number(p.amount), 0),
        count: dayPayments.length,
      };
    });
  }, [payments, dateRange]);

  // Trend line (cumulative count per day)
  const trendData = useMemo(() => {
    if (!payments) return [];
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    let cumulative = 0;
    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const count = payments.filter((p) => p.created_at.startsWith(dayStr)).length;
      cumulative += count;
      return { date: format(day, "dd MMM"), count, cumulative };
    });
  }, [payments, dateRange]);

  // Pie chart data
  const pieData = useMemo(() => {
    if (!payments) return [];
    const matched = payments.filter((p) => p.status === "matched").length;
    const review = payments.filter((p) => p.status === "manual_review").length;
    const unmatched = payments.filter((p) => p.status === "unmatched").length;
    const rejected = payments.filter((p) => p.status === "rejected").length;
    return [
      { name: "Matched", value: matched },
      { name: "Review", value: review },
      { name: "Unmatched", value: unmatched },
      { name: "Rejected", value: rejected },
    ].filter((d) => d.value > 0);
  }, [payments]);

  // Summary stats
  const totalAmount = payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const totalCount = payments?.length ?? 0;
  const matchedCount = payments?.filter((p) => p.status === "matched").length ?? 0;
  const matchRate = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  const periodLabels: Record<Period, string> = {
    "7days": "Last 7 Days",
    "30days": "Last 30 Days",
    "this_week": "This Week",
    "this_month": "This Month",
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Reports</h1>
          <p className="text-muted-foreground mt-1">Merchant payment trends & analytics</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {periodLabels[p]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="text-xl font-bold text-foreground">৳{totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="text-xl font-bold text-foreground">{totalCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Matched</p>
                    <p className="text-xl font-bold text-foreground">{matchedCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Match Rate</p>
                    <p className="text-xl font-bold text-foreground">{matchRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Daily Amount Bar Chart */}
            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Payment Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="matched" name="Matched" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="review" name="Review" fill="#f59e0b" radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="unmatched" name="Unmatched" fill="#94a3b8" radius={[2, 2, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Pie Chart */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  {pieData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Trend Line */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transaction Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" name="Daily" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}