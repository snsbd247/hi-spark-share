import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Wallet } from "lucide-react";
import ReportToolbar from "@/components/reports/ReportToolbar";

export default function CashFlowReport() {
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const { data: payments = [] } = useQuery({
    queryKey: ["cf-payments"], queryFn: async () => { const { data } = await db.from("payments").select("amount, status, paid_at, created_at"); return data || []; },
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["cf-expenses"], queryFn: async () => { const { data } = await db.from("expenses").select("amount, date, created_at"); return data || []; },
  });

  const completed = payments.filter((p: any) => p.status === "completed");
  const yr = Number(year);

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthStr = `${yr}-${String(m).padStart(2, "0")}`;
    const label = new Date(yr, i).toLocaleString("default", { month: "short" });
    const inflow = completed.filter((p: any) => (p.paid_at || p.created_at)?.startsWith(monthStr)).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const outflow = expenses.filter((e: any) => (e.date || e.created_at)?.startsWith(monthStr)).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    return { month: label, inflow, outflow, net: inflow - outflow };
  });

  const columns = [
    { header: "Month", key: "month" },
    { header: "Inflow", key: "inflow", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: "Outflow", key: "outflow", format: (v: number) => `Tk ${v.toLocaleString()}` },
    { header: "Net", key: "net", format: (v: number) => `Tk ${v.toLocaleString()}` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Wallet className="h-6 w-6" /> Cash Flow Report</h1>
          <p className="text-muted-foreground text-sm">Monthly cash inflow vs outflow</p>
        </div>

        <ReportToolbar title={`Cash Flow Report - ${year}`} data={months} columns={columns} showDateFilter={false}>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2].map(i => { const y = String(new Date().getFullYear() - i); return <SelectItem key={y} value={y}>{y}</SelectItem>; })}
            </SelectContent>
          </Select>
        </ReportToolbar>

        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly Cash Flow - {year}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="inflow" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Inflow" />
                <Bar dataKey="outflow" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Outflow" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
