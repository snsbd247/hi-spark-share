import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import ReportToolbar from "@/components/reports/ReportToolbar";

export default function ProfitLossReport() {
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const { data: payments = [] } = useQuery({
    queryKey: ["pl-payments"], queryFn: async () => { const { data } = await db.from("payments").select("amount, status, paid_at, created_at"); return data || []; },
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["pl-expenses"], queryFn: async () => { const { data } = await db.from("expenses").select("amount, date, created_at"); return data || []; },
  });

  const completed = payments.filter((p: any) => p.status === "completed");
  const yr = Number(year);
  let yearlyRevenue = 0, yearlyExpense = 0;

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthStr = `${yr}-${String(m).padStart(2, "0")}`;
    const label = new Date(yr, i).toLocaleString("default", { month: "short" });
    const rev = completed.filter((p: any) => (p.paid_at || p.created_at)?.startsWith(monthStr)).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const exp = expenses.filter((e: any) => (e.date || e.created_at)?.startsWith(monthStr)).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    yearlyRevenue += rev; yearlyExpense += exp;
    return { month: label, revenue: rev, expense: exp, profit: rev - exp };
  });

  const columns = [
    { header: "Month", key: "month" },
    { header: "Revenue", key: "revenue", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: "Expense", key: "expense", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: "Profit", key: "profit", format: (v: number) => `Tk ${v.toLocaleString()}` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profit & Loss Report</h1>
            <p className="text-muted-foreground text-sm">Monthly revenue vs expense analysis</p>
          </div>
        </div>

        <ReportToolbar
          title={`Profit & Loss Report - ${year}`}
          data={months}
          columns={columns}
          showDateFilter={false}
        >
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2].map(i => { const y = String(new Date().getFullYear() - i); return <SelectItem key={y} value={y}>{y}</SelectItem>; })}
            </SelectContent>
          </Select>
        </ReportToolbar>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Yearly Revenue</p><p className="text-2xl font-bold text-primary">৳{yearlyRevenue.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Yearly Expense</p><p className="text-2xl font-bold text-destructive">৳{yearlyExpense.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Net Profit</p><p className={`text-2xl font-bold ${yearlyRevenue - yearlyExpense >= 0 ? "text-primary" : "text-destructive"}`}>৳{(yearlyRevenue - yearlyExpense).toLocaleString()}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly P&L - {year}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
