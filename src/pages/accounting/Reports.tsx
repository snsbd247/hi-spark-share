import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Building2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateProfitLossPDF } from "@/lib/accountingPdf";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Reports() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data: sales = [] } = useQuery({
    queryKey: ["sales", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant(( db as any).from("sales").select("*"), tenantId); return data || []; },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant(( db as any).from("purchases").select("*"), tenantId); return data || []; },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant(( db as any).from("expenses").select("*"), tenantId); return data || []; },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", tenantId],
    queryFn: async () => { const { data } = await ( db as any).from("suppliers").select("*"); return data || []; },
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthlyPL = monthNames.map((name, idx) => {
    const monthStr = `${year}-${String(idx + 1).padStart(2, "0")}`;
    const income = sales
      .filter((s: any) => s.sale_date?.startsWith(monthStr))
      .reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const purchaseCost = purchases
      .filter((p: any) => (p.date || "").substring(0, 7) === monthStr)
      .reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0);
    const expenseCost = expenses
      .filter((e: any) => e.date?.startsWith(monthStr))
      .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const totalExpense = purchaseCost + expenseCost;
    return { month: name, income, expense: totalExpense, profit: income - totalExpense };
  });

  const annualIncome = monthlyPL.reduce((s, m) => s + m.income, 0);
  const annualExpense = monthlyPL.reduce((s, m) => s + m.expense, 0);
  const annualProfit = annualIncome - annualExpense;

  const dailyData = (() => {
    const days: Record<string, { date: string; income: number; expense: number; profit: number }> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days[key] = { date: key.substring(5), income: 0, expense: 0, profit: 0 };
    }
    sales.forEach((s: any) => { if (days[s.sale_date]) days[s.sale_date].income += Number(s.total || 0); });
    purchases.forEach((p: any) => { const d = (p.date || "").substring(0, 10); if (days[d]) days[d].expense += Number(p.total_amount || 0); });
    expenses.forEach((e: any) => { if (days[e.date]) days[e.date].expense += Number(e.amount || 0); });
    Object.values(days).forEach(d => { d.profit = d.income - d.expense; });
    return Object.values(days);
  })();

  const suppliersWithDue = suppliers
    .filter((v: any) => Number(v.total_due || 0) > 0)
    .sort((a: any, b: any) => Number(b.total_due) - Number(a.total_due));
  const totalSupplierDue = suppliers.reduce((s: number, v: any) => s + Number(v.total_due || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financial Reports</h1>
            <p className="text-muted-foreground text-sm">Profit & Loss, supplier dues, and financial analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => generateProfitLossPDF(monthlyPL, year, { income: annualIncome, expense: annualExpense, profit: annualProfit })}>
              <FileDown className="h-4 w-4 mr-2" />Export PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div><p className="text-2xl font-bold">৳{annualIncome.toLocaleString()}</p><p className="text-sm text-muted-foreground">Annual Income ({year})</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-destructive" />
                <div><p className="text-2xl font-bold">৳{annualExpense.toLocaleString()}</p><p className="text-sm text-muted-foreground">Annual Expenses ({year})</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className={`h-8 w-8 ${annualProfit >= 0 ? "text-green-500" : "text-destructive"}`} />
                <div><p className={`text-2xl font-bold ${annualProfit >= 0 ? "" : "text-destructive"}`}>৳{annualProfit.toLocaleString()}</p><p className="text-sm text-muted-foreground">Net Profit ({year})</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="monthly">
          <TabsList>
            <TabsTrigger value="monthly">Monthly P&L</TabsTrigger>
            <TabsTrigger value="daily">Daily (30 Days)</TabsTrigger>
            <TabsTrigger value="supplier-dues">Supplier Dues</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Monthly Profit & Loss — {year}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={monthlyPL}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="income" fill="hsl(var(--primary))" name="Income" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="hsl(var(--destructive))" name="Expense" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Profit & Loss Statement</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Income</TableHead>
                      <TableHead className="text-right">Expense</TableHead>
                      <TableHead className="text-right">Profit/Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyPL.map(m => (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium">{m.month} {year}</TableCell>
                        <TableCell className="text-right">৳{m.income.toLocaleString()}</TableCell>
                        <TableCell className="text-right">৳{m.expense.toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-bold ${m.profit >= 0 ? "" : "text-destructive"}`}>৳{m.profit.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-foreground/20">
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">৳{annualIncome.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold">৳{annualExpense.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-bold ${annualProfit >= 0 ? "" : "text-destructive"}`}>৳{annualProfit.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Last 30 Days — Income & Expense Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="hsl(var(--primary))" name="Income" strokeWidth={2} />
                    <Line type="monotone" dataKey="expense" stroke="hsl(var(--destructive))" name="Expense" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" stroke="#10b981" name="Profit" strokeWidth={2} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="supplier-dues" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Building2 className="h-8 w-8 text-destructive" />
                  <div><p className="text-2xl font-bold">৳{totalSupplierDue.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Supplier Dues</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Supplier-wise Outstanding Dues</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-right">Due Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliersWithDue.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No outstanding supplier dues</TableCell></TableRow>
                    ) : suppliersWithDue.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell>{v.phone || "—"}</TableCell>
                        <TableCell>{v.company || "—"}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">৳{Number(v.total_due).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={v.status === "active" ? "default" : "secondary"}>{v.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
