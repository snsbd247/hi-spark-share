import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, DollarSign, Receipt, MessageSquare,
  Package, BookOpen, BarChart3, PieChart as PieIcon
} from "lucide-react";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--destructive))", "#f59e0b", "#10b981",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

function MetricCard({ title, value, icon: Icon, trend, subtitle, color = "text-primary" }: {
  title: string; value: string | number; icon: any; trend?: string; subtitle?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        {trend && (
          <p className={`text-xs mt-2 flex items-center gap-1 ${trend.startsWith("+") ? "text-green-600" : "text-destructive"}`}>
            {trend.startsWith("+") ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function TenantFinancialReportsTab({ tenantId }: { tenantId: string }) {
  const [reportTab, setReportTab] = useState("overview");
  const [plYear, setPlYear] = useState(String(new Date().getFullYear()));

  // ── Overview ──
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["tenant-report-overview", tenantId],
    queryFn: () => superAdminApi.getTenantReportOverview(tenantId),
    enabled: !!tenantId,
  });

  // ── Revenue ──
  const { data: revenue } = useQuery({
    queryKey: ["tenant-report-revenue", tenantId],
    queryFn: () => superAdminApi.getTenantReportRevenue(tenantId),
    enabled: !!tenantId && reportTab === "revenue",
  });

  // ── Expense ──
  const { data: expense } = useQuery({
    queryKey: ["tenant-report-expense", tenantId],
    queryFn: () => superAdminApi.getTenantReportExpense(tenantId),
    enabled: !!tenantId && reportTab === "expense",
  });

  // ── P&L ──
  const { data: profitLoss } = useQuery({
    queryKey: ["tenant-report-pl", tenantId, plYear],
    queryFn: () => superAdminApi.getTenantReportProfitLoss(tenantId, Number(plYear)),
    enabled: !!tenantId && reportTab === "profitloss",
  });

  // ── Customers ──
  const { data: customerData } = useQuery({
    queryKey: ["tenant-report-customers", tenantId],
    queryFn: () => superAdminApi.getTenantReportCustomers(tenantId),
    enabled: !!tenantId && reportTab === "customers",
  });

  // ── SMS ──
  const { data: smsData } = useQuery({
    queryKey: ["tenant-report-sms", tenantId],
    queryFn: () => superAdminApi.getTenantReportSms(tenantId),
    enabled: !!tenantId && reportTab === "sms",
  });

  // ── Payments ──
  const { data: payments } = useQuery({
    queryKey: ["tenant-report-payments", tenantId],
    queryFn: () => superAdminApi.getTenantReportPayments(tenantId),
    enabled: !!tenantId && reportTab === "payments",
  });

  // ── Ledger ──
  const { data: ledger } = useQuery({
    queryKey: ["tenant-report-ledger", tenantId],
    queryFn: () => superAdminApi.getTenantReportLedger(tenantId),
    enabled: !!tenantId && reportTab === "ledger",
  });

  if (loadingOverview) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const o = overview || {};

  return (
    <div className="space-y-4">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Total Revenue" value={`৳${Number(o.total_revenue || 0).toLocaleString()}`} icon={DollarSign} color="text-primary" subtitle={`This month: ৳${Number(o.monthly_revenue || 0).toLocaleString()}`} />
        <MetricCard title="Total Expense" value={`৳${Number(o.total_expense || 0).toLocaleString()}`} icon={TrendingDown} color="text-destructive" subtitle={`This month: ৳${Number(o.monthly_expense || 0).toLocaleString()}`} />
        <MetricCard title="Net Profit" value={`৳${Number(o.net_profit || 0).toLocaleString()}`} icon={TrendingUp} color={o.net_profit >= 0 ? "text-primary" : "text-destructive"} subtitle={`Monthly: ৳${Number(o.monthly_profit || 0).toLocaleString()}`} />
        <MetricCard title="Collection Rate" value={`${o.collection_rate || 0}%`} icon={Receipt} subtitle={`Due: ৳${Number(o.total_due || 0).toLocaleString()}`} />
        <MetricCard title="Active Customers" value={o.active_customers || 0} icon={Users} subtitle={`Total: ${o.total_customers || 0}`} />
        <MetricCard title="ARPU" value={`৳${Number(o.arpu || 0).toLocaleString()}`} icon={BarChart3} subtitle="Avg Revenue Per User" />
        <MetricCard title="Churn Rate" value={`${o.churn_rate || 0}%`} icon={TrendingDown} color={o.churn_rate > 5 ? "text-destructive" : "text-primary"} subtitle={`${o.churn_count || 0} inactive`} />
        <MetricCard title="SMS This Month" value={o.monthly_sms || 0} icon={MessageSquare} subtitle={`Total: ${o.total_sms || 0}`} />
      </div>

      {/* ── Report Tabs ── */}
      <Tabs value={reportTab} onValueChange={setReportTab}>
        <TabsList className="w-full grid grid-cols-4 md:grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="profitloss">P&L</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Billing Summary (Current Month)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Billed</span><span className="font-semibold">৳{Number(o.total_billed || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span className="font-semibold text-primary">৳{Number(o.total_collected || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Outstanding Due</span><span className="font-semibold text-destructive">৳{Number(o.total_due || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Inventory Value</span><span className="font-semibold">৳{Number(o.inventory_value || 0).toLocaleString()}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Customer Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold">{o.total_customers || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span className="font-semibold text-primary">{o.active_customers || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Inactive</span><span className="font-semibold text-destructive">{o.inactive_customers || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">ARPU</span><span className="font-semibold">৳{Number(o.arpu || 0).toLocaleString()}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Revenue Tab ── */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Daily Revenue (Last 30 Days)</CardTitle></CardHeader>
            <CardContent>
              {revenue?.daily?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenue.daily}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-muted-foreground py-8">No revenue data</p>}

              {revenue?.by_method?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">By Payment Method</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {revenue.by_method.map((m: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground capitalize">{m.payment_method}</p>
                        <p className="text-sm font-bold">৳{Number(m.total).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{m.count} payments</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Expense Tab ── */}
        <TabsContent value="expense">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><PieIcon className="h-4 w-4" /> Expense by Category</CardTitle></CardHeader>
              <CardContent>
                {expense?.by_category?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={expense.by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }: any) => `${category} (${(percent * 100).toFixed(0)}%)`}>
                        {expense.by_category.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                {expense?.daily?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={expense.daily}>
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
        </TabsContent>

        {/* ── Profit & Loss Tab ── */}
        <TabsContent value="profitloss">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Monthly Profit & Loss</CardTitle>
                <Select value={plYear} onValueChange={setPlYear}>
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2].map(i => {
                      const y = String(new Date().getFullYear() - i);
                      return <SelectItem key={y} value={y}>{y}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {profitLoss?.months?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={profitLoss.months}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                      <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expense" />
                    </BarChart>
                  </ResponsiveContainer>
                  {profitLoss.yearly && (
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                       <div className="text-center"><p className="text-xs text-muted-foreground">Yearly Revenue</p><p className="text-lg font-bold text-primary">৳{Number(profitLoss.yearly.revenue).toLocaleString()}</p></div>
                       <div className="text-center"><p className="text-xs text-muted-foreground">Yearly Expense</p><p className="text-lg font-bold text-destructive">৳{Number(profitLoss.yearly.expense).toLocaleString()}</p></div>
                       <div className="text-center"><p className="text-xs text-muted-foreground">Net Profit</p><p className={`text-lg font-bold ${profitLoss.yearly.profit >= 0 ? "text-primary" : "text-destructive"}`}>৳{Number(profitLoss.yearly.profit).toLocaleString()}</p></div>
                    </div>
                  )}
                </>
              ) : <p className="text-center text-muted-foreground py-8">No data</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Customers Tab ── */}
        <TabsContent value="customers">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Customer Growth (Monthly)</CardTitle></CardHeader>
              <CardContent>
                {customerData?.monthly_growth?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[...customerData.monthly_growth].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="New Customers" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-8">No data</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">By Status</CardTitle></CardHeader>
              <CardContent>
                {customerData?.by_status?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={customerData.by_status} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, count }: any) => `${status} (${count})`}>
                        {customerData.by_status.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-8">No data</p>}
              </CardContent>
            </Card>
            {customerData?.by_area?.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-sm">Top Areas</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Area</TableHead><TableHead className="text-right">Customers</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {customerData.by_area.map((a: any, i: number) => (
                        <TableRow key={i}><TableCell>{a.area}</TableCell><TableCell className="text-right font-semibold">{a.count}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Payments Tab ── */}
        <TabsContent value="payments">
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Payments</CardTitle></CardHeader>
            <CardContent>
              {(payments || []).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payments || []).slice(0, 30).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-GB") : "—"}</TableCell>
                        <TableCell className="text-sm">{p.customer?.name || "—"} <span className="text-muted-foreground text-xs">({p.customer?.customer_id})</span></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{p.payment_method}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">৳{Number(p.amount).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={p.status === "completed" ? "default" : "secondary"} className="text-xs capitalize">{p.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center text-muted-foreground py-8">No payments found</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Ledger Tab ── */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" /> General Ledger (Current Month)</CardTitle></CardHeader>
            <CardContent>
              {ledger?.transactions?.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.transactions.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm">{t.date ? new Date(t.date).toLocaleDateString("en-GB") : "—"}</TableCell>
                          <TableCell className="text-sm">{t.account?.name || "—"} <span className="text-xs text-muted-foreground">{t.account?.code}</span></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.description || "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{Number(t.debit) > 0 ? `৳${Number(t.debit).toLocaleString()}` : "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{Number(t.credit) > 0 ? `৳${Number(t.credit).toLocaleString()}` : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end gap-6 mt-4 pt-4 border-t text-sm">
                    <span>Total Debit: <strong>৳{Number(ledger.total_debit).toLocaleString()}</strong></span>
                    <span>Total Credit: <strong>৳{Number(ledger.total_credit).toLocaleString()}</strong></span>
                  </div>
                </>
              ) : <p className="text-center text-muted-foreground py-8">No transactions found</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
