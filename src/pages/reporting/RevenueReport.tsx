import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, subDays } from "date-fns";
import ReportToolbar from "@/components/reports/ReportToolbar";

export default function RevenueReport() {
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const { data: payments = [] } = useQuery({
    queryKey: ["revenue-report-payments", dateFrom, dateTo],
    queryFn: async () => {
      let q = db.from("payments").select("*");
      if (dateFrom) q = q.gte("paid_at", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("paid_at", `${dateTo}T23:59:59`);
      const { data } = await q;
      return data || [];
    },
  });

  const completed = payments.filter((p: any) => p.status === "completed");

  const dailyMap: Record<string, number> = {};
  completed.forEach((p: any) => {
    const d = (p.paid_at || p.created_at)?.substring(0, 10);
    if (d) dailyMap[d] = (dailyMap[d] || 0) + Number(p.amount || 0);
  });
  const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));

  const methodMap: Record<string, { total: number; count: number }> = {};
  completed.forEach((p: any) => {
    const m = p.payment_method || "cash";
    if (!methodMap[m]) methodMap[m] = { total: 0, count: 0 };
    methodMap[m].total += Number(p.amount || 0);
    methodMap[m].count++;
  });
  const byMethod = Object.entries(methodMap).map(([method, v]) => ({ method, ...v }));

  const totalRevenue = completed.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const tableData = completed.map((p: any) => ({
    date: (p.paid_at || p.created_at)?.substring(0, 10) || "",
    method: p.payment_method || "cash",
    amount: Number(p.amount || 0),
    status: p.status,
  }));

  const columns = [
    { header: "Date", key: "date" },
    { header: "Payment Method", key: "method" },
    { header: "Amount", key: "amount", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: "Status", key: "status" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue Report</h1>
          <p className="text-muted-foreground text-sm">Daily revenue and payment method breakdown</p>
        </div>

        <ReportToolbar
          title="Revenue Report"
          data={tableData}
          columns={columns}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-3xl font-bold text-primary">৳{totalRevenue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Daily Revenue</CardTitle></CardHeader>
          <CardContent>
            {daily.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8">No revenue data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">By Payment Method</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {byMethod.map((m, i) => (
                <div key={i} className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground capitalize">{m.method}</p>
                  <p className="text-lg font-bold">৳{m.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{m.count} payments</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
