import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#6366f1"];

export default function AccountingDashboard() {
  const { t } = useLanguage();
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => { const { data } = await db.from("products").select("*"); return data || []; },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => { const { data } = await db.from("purchases").select("*"); return data || []; },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => { const { data } = await db.from("sales").select("*"); return data || []; },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => { const { data } = await db.from("expenses").select("*"); return data || []; },
  });

  const totalSales = sales.reduce((s: number, sale: any) => s + Number(sale.total || 0), 0);
  const totalPurchases = purchases.reduce((s: number, p: any) => s + Number(p.total || 0), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const netProfit = totalSales - totalPurchases - totalExpenses;
  const lowStockProducts = products.filter((p: any) => p.stock_quantity <= p.low_stock_alert);

  // Monthly summary for chart
  const monthlyData = (() => {
    const months: Record<string, { month: string; income: number; expense: number }> = {};
    sales.forEach((s: any) => {
      const m = s.sale_date?.substring(0, 7) || "Unknown";
      if (!months[m]) months[m] = { month: m, income: 0, expense: 0 };
      months[m].income += Number(s.total || 0);
    });
    purchases.forEach((p: any) => {
      const m = p.purchase_date?.substring(0, 7) || "Unknown";
      if (!months[m]) months[m] = { month: m, income: 0, expense: 0 };
      months[m].expense += Number(p.total || 0);
    });
    expenses.forEach((e: any) => {
      const m = e.date?.substring(0, 7) || "Unknown";
      if (!months[m]) months[m] = { month: m, income: 0, expense: 0 };
      months[m].expense += Number(e.amount || 0);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  })();

  // Expense by category for pie chart
  const expenseByCategory = (() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e: any) => {
      cats[e.category || "other"] = (cats[e.category || "other"] || 0) + Number(e.amount || 0);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.accounting.title}</h1>
          <p className="text-muted-foreground text-sm">{t.accounting.financialOverview}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div><p className="text-2xl font-bold">৳{totalSales.toLocaleString()}</p><p className="text-sm text-muted-foreground">{t.accounting.totalSales}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-8 w-8 text-blue-500" />
                <div><p className="text-2xl font-bold">৳{totalPurchases.toLocaleString()}</p><p className="text-sm text-muted-foreground">{t.accounting.totalPurchases}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-destructive" />
                <div><p className="text-2xl font-bold">৳{totalExpenses.toLocaleString()}</p><p className="text-sm text-muted-foreground">{t.accounting.totalExpenses}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className={`h-8 w-8 ${netProfit >= 0 ? "text-green-500" : "text-destructive"}`} />
                <div><p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>৳{netProfit.toLocaleString()}</p><p className="text-sm text-muted-foreground">{t.accounting.netProfit}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>{t.accounting.incomeVsExpense}</CardTitle></CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                    <Bar dataKey="income" fill="hsl(var(--primary))" name={t.accounting.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="hsl(var(--destructive))" name={t.accounting.expense} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">No data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Expenses by Category</CardTitle></CardHeader>
            <CardContent>
              {expenseByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={expenseByCategory} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">No expenses recorded</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        {lowStockProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Alert Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.sku}</TableCell>
                      <TableCell className="text-right text-destructive font-bold">{p.stock_quantity}</TableCell>
                      <TableCell className="text-right">{p.low_stock_alert}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
