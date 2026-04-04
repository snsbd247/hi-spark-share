import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, TrendingUp, Wallet, CheckCircle, AlertCircle, CalendarIcon, Download, FileText } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { cn , safeFormat } from "@/lib/utils";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

const PIE_COLORS = ["#22c55e", "#f59e0b", "#94a3b8", "#ef4444"];

type Period = "7days" | "30days" | "this_week" | "this_month" | "custom";

export default function MerchantPaymentReports() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("30days");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();

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
      case "custom":
        return { from: customFrom || subDays(now, 29), to: customTo || now };
    }
  }, [period, customFrom, customTo]);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["merchant-report", period, dateRange.from.toISOString(), dateRange.to.toISOString(), tenantId],
    queryFn: async () => {
      const { data, error } = await db
        .from("merchant_payments")
        .select("id, amount, status, created_at, transaction_id, sender_phone, reference")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

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

  const pieData = useMemo(() => {
    if (!payments) return [];
    return [
      { name: "Matched", value: payments.filter((p) => p.status === "matched").length },
      { name: "Review", value: payments.filter((p) => p.status === "manual_review").length },
      { name: "Unmatched", value: payments.filter((p) => p.status === "unmatched").length },
      { name: "Rejected", value: payments.filter((p) => p.status === "rejected").length },
    ].filter((d) => d.value > 0);
  }, [payments]);

  const totalAmount = payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const totalCount = payments?.length ?? 0;
  const matchedCount = payments?.filter((p) => p.status === "matched").length ?? 0;
  const matchRate = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  const periodLabels: Record<Period, string> = {
    "7days": "7 Days",
    "30days": "30 Days",
    "this_week": "This Week",
    "this_month": "This Month",
    "custom": "Custom",
  };

  // CSV Export
  const exportCSV = useCallback(() => {
    if (!payments?.length) { toast.error("No data to export"); return; }
    const headers = ["Date", "Transaction ID", "Sender Phone", "Amount", "Reference", "Status"];
    const rows = payments.map((p) => [
      safeFormat(p.created_at, "yyyy-MM-dd HH:mm"),
      p.transaction_id,
      p.sender_phone,
      p.amount,
      p.reference || "",
      p.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `merchant-payments-${format(dateRange.from, "yyyyMMdd")}-${format(dateRange.to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }, [payments, dateRange]);

  // PDF Export
  const exportPDF = useCallback(() => {
    if (!payments?.length) { toast.error("No data to export"); return; }
    const doc = new jsPDF();
    const rangeLabel = `${format(dateRange.from, "dd MMM yyyy")} — ${format(dateRange.to, "dd MMM yyyy")}`;

    doc.setFontSize(16);
    doc.text("Merchant Payment Report", 14, 20);
    doc.setFontSize(10);
    doc.text(rangeLabel, 14, 28);
    doc.text(`Total: ${totalCount} transactions | Amount: Tk ${totalAmount.toLocaleString()} | Match Rate: ${matchRate}%`, 14, 35);

    // Table header
    const startY = 45;
    const colWidths = [35, 30, 30, 25, 30, 30];
    const headers = ["Date", "TrxID", "Phone", "Amount", "Reference", "Status"];
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => {
      doc.text(h, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), startY);
    });

    doc.setFont("helvetica", "normal");
    let y = startY + 6;
    payments.forEach((p) => {
      if (y > 280) { doc.addPage(); y = 20; }
      const row = [
        safeFormat(p.created_at, "dd/MM/yy HH:mm"),
        p.transaction_id.substring(0, 12),
        p.sender_phone,
        `${p.amount}`,
        (p.reference || "—").substring(0, 12),
        p.status,
      ];
      row.forEach((val, i) => {
        doc.text(val, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y);
      });
      y += 5;
    });

    doc.save(`merchant-payments-${format(dateRange.from, "yyyyMMdd")}-${format(dateRange.to, "yyyyMMdd")}.pdf`);
    toast.success("PDF exported");
  }, [payments, dateRange, totalCount, totalAmount, matchRate]);

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.sidebar.paymentReports}</h1>
          <p className="text-muted-foreground mt-1">Merchant payment trends & analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!payments?.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={!payments?.length}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* Period Selector + Date Range Picker */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(Object.keys(periodLabels) as Period[]).filter((p) => p !== "custom").map((p) => (
          <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
            {periodLabels[p]}
          </Button>
        ))}

        <div className="flex items-center gap-1.5 ml-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={period === "custom" ? "default" : "outline"}
                size="sm"
                className={cn("justify-start text-left font-normal", !customFrom && period !== "custom" && "text-muted-foreground")}
                onClick={() => setPeriod("custom")}
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                {customFrom ? format(customFrom, "dd MMM yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={(d) => { setCustomFrom(d); setPeriod("custom"); }}
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-sm">—</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={period === "custom" ? "default" : "outline"}
                size="sm"
                className={cn("justify-start text-left font-normal", !customTo && period !== "custom" && "text-muted-foreground")}
                onClick={() => setPeriod("custom")}
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                {customTo ? format(customTo, "dd MMM yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={(d) => { setCustomTo(d); setPeriod("custom"); }}
                disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
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
            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Payment Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="matched" name="Matched" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="review" name="Review" fill="#f59e0b" radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="unmatched" name="Unmatched" fill="#94a3b8" radius={[2, 2, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

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
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
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