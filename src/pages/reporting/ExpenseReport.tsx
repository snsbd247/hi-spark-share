import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import ReportToolbar from "@/components/reports/ReportToolbar";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function ExpenseReport() {
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const { data: expenses = [] } = useQuery({
    queryKey: ["expense-report", dateFrom, dateTo],
    queryFn: async () => {
      let q = db.from("expenses").select("*");
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo);
      const { data } = await q;
      return data || [];
    },
  });

  const totalExpense = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  const catMap: Record<string, number> = {};
  expenses.forEach((e: any) => {
    const cat = e.category || "other";
    catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
  });
  const byCategory = Object.entries(catMap).map(([category, total]) => ({ category, total }));

  const dailyMap: Record<string, number> = {};
  expenses.forEach((e: any) => {
    const d = (e.date || e.created_at)?.substring(0, 10);
    if (d) dailyMap[d] = (dailyMap[d] || 0) + Number(e.amount || 0);
  });
  const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));

  const tableData = expenses.map((e: any) => ({
    date: (e.date || e.created_at)?.substring(0, 10) || "",
    category: e.category || "other",
    description: e.description || "",
    amount: Number(e.amount || 0),
    method: e.payment_method || "cash",
  }));

  const columns = [
    { header: "Date", key: "date" },
    { header: "Category", key: "category" },
    { header: "Description", key: "description" },
    { header: "Amount", key: "amount", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: "Method", key: "method" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Report</h1>
          <p className="text-muted-foreground text-sm">Expense breakdown by category and daily trend</p>
        </div>

        <ReportToolbar
          title="Expense Report"
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
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-3xl font-bold text-destructive">৳{totalExpense.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><PieIcon className="h-4 w-4" /> By Category</CardTitle></CardHeader>
            <CardContent>
              {byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={({ category, percent }: any) => `${category} (${(percent * 100).toFixed(0)}%)`}>
                      {byCategory.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-muted-foreground py-8">No expense data</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Daily Expense Trend</CardTitle></CardHeader>
            <CardContent>
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-muted-foreground py-8">No data</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
