import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, DollarSign, Receipt, MessageSquare,
  Package, BookOpen, BarChart3, PieChart as PieIcon, Scale, Wallet,
  AlertTriangle, CheckCircle2
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
  const [reportTab, setReportTab] = useState("revenue");
  const [plYear, setPlYear] = useState(String(new Date().getFullYear()));

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["tenant-report-overview", tenantId],
    queryFn: () => superAdminApi.getTenantReportOverview(tenantId),
    enabled: !!tenantId,
  });

  const { data: revenue } = useQuery({
    queryKey: ["tenant-report-revenue", tenantId],
    queryFn: () => superAdminApi.getTenantReportRevenue(tenantId),
    enabled: !!tenantId && reportTab === "revenue",
  });

  const { data: expense } = useQuery({
    queryKey: ["tenant-report-expense", tenantId],
    queryFn: () => superAdminApi.getTenantReportExpense(tenantId),
    enabled: !!tenantId && reportTab === "expense",
  });

  const { data: profitLoss } = useQuery({
    queryKey: ["tenant-report-pl", tenantId, plYear],
    queryFn: () => superAdminApi.getTenantReportProfitLoss(tenantId, Number(plYear)),
    enabled: !!tenantId && reportTab === "profitloss",
  });

  const { data: customerData } = useQuery({
    queryKey: ["tenant-report-customers", tenantId],
    queryFn: () => superAdminApi.getTenantReportCustomers(tenantId),
    enabled: !!tenantId && reportTab === "customers",
  });

  const { data: smsData } = useQuery({
    queryKey: ["tenant-report-sms", tenantId],
    queryFn: () => superAdminApi.getTenantReportSms(tenantId),
    enabled: !!tenantId && reportTab === "sms",
  });

  const { data: payments } = useQuery({
    queryKey: ["tenant-report-payments", tenantId],
    queryFn: () => superAdminApi.getTenantReportPayments(tenantId),
    enabled: !!tenantId && reportTab === "payments",
  });

  const { data: ledger } = useQuery({
    queryKey: ["tenant-report-ledger", tenantId],
    queryFn: () => superAdminApi.getTenantReportLedger(tenantId),
    enabled: !!tenantId && reportTab === "ledger",
  });

  const { data: trialBalance } = useQuery({
    queryKey: ["tenant-report-trial-balance", tenantId],
    queryFn: () => superAdminApi.getTenantReportTrialBalance(tenantId),
    enabled: !!tenantId && reportTab === "trial-balance",
  });

  const { data: balanceSheet } = useQuery({
    queryKey: ["tenant-report-balance-sheet", tenantId],
    queryFn: () => superAdminApi.getTenantReportBalanceSheet(tenantId),
    enabled: !!tenantId && reportTab === "balance-sheet",
  });

  const { data: accountBalances } = useQuery({
    queryKey: ["tenant-report-account-balances", tenantId],
    queryFn: () => superAdminApi.getTenantReportAccountBalances(tenantId),
    enabled: !!tenantId && reportTab === "accounts",
  });

  const { data: receivablePayable } = useQuery({
    queryKey: ["tenant-report-receivable-payable", tenantId],
    queryFn: () => superAdminApi.getTenantReportReceivablePayable(tenantId),
    enabled: !!tenantId && reportTab === "receivable",
  });

  const { data: inventoryData } = useQuery({
    queryKey: ["tenant-report-inventory", tenantId],
    queryFn: () => superAdminApi.getTenantReportInventory(tenantId),
    enabled: !!tenantId && reportTab === "inventory",
  });

  const { data: cashFlow } = useQuery({
    queryKey: ["tenant-report-cash-flow", tenantId, plYear],
    queryFn: () => superAdminApi.getTenantReportCashFlow(tenantId, Number(plYear)),
    enabled: !!tenantId && reportTab === "cashflow",
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
      {/* KPI Cards */}
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

      {/* Report Tabs */}
      <Tabs value={reportTab} onValueChange={setReportTab}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="profitloss">P&L</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="receivable">Receivable/Payable</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Revenue */}
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

        {/* Expense */}
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

        {/* P&L */}
        <TabsContent value="profitloss">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Monthly Profit & Loss</CardTitle>
                <Select value={plYear} onValueChange={setPlYear}>
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2].map(i => { const y = String(new Date().getFullYear() - i); return <SelectItem key={y} value={y}>{y}</SelectItem>; })}
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

        {/* Cash Flow */}
        <TabsContent value="cashflow">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> Monthly Cash Flow</CardTitle>
                <Select value={plYear} onValueChange={setPlYear}>
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2].map(i => { const y = String(new Date().getFullYear() - i); return <SelectItem key={y} value={y}>{y}</SelectItem>; })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {cashFlow?.months?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={cashFlow.months}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="inflow" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Cash In" />
                      <Bar dataKey="outflow" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Cash Out" />
                      <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} name="Net Flow" />
                    </BarChart>
                  </ResponsiveContainer>
                  {cashFlow.yearly && (
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                      <div className="text-center"><p className="text-xs text-muted-foreground">Total Inflow</p><p className="text-lg font-bold text-primary">৳{Number(cashFlow.yearly.inflow).toLocaleString()}</p></div>
                      <div className="text-center"><p className="text-xs text-muted-foreground">Total Outflow</p><p className="text-lg font-bold text-destructive">৳{Number(cashFlow.yearly.outflow).toLocaleString()}</p></div>
                      <div className="text-center"><p className="text-xs text-muted-foreground">Net Cash Flow</p><p className={`text-lg font-bold ${cashFlow.yearly.net >= 0 ? "text-primary" : "text-destructive"}`}>৳{Number(cashFlow.yearly.net).toLocaleString()}</p></div>
                    </div>
                  )}
                </>
              ) : <p className="text-center text-muted-foreground py-8">No data</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial-balance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" /> Trial Balance</CardTitle>
                {trialBalance && (
                  <Badge variant={trialBalance.is_balanced ? "default" : "destructive"}>
                    {trialBalance.is_balanced ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Balanced</> : <><AlertTriangle className="h-3 w-3 mr-1" /> Imbalanced</>}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {trialBalance?.accounts?.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialBalance.accounts.map((a: any) => (
                        <TableRow key={a.account_id}>
                          <TableCell className="text-xs text-muted-foreground">{a.account_code}</TableCell>
                          <TableCell className="text-sm font-medium">{a.account_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs capitalize">{a.account_type}</Badge></TableCell>
                          <TableCell className="text-right font-semibold">{Number(a.debit) > 0 ? `৳${Number(a.debit).toLocaleString()}` : "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{Number(a.credit) > 0 ? `৳${Number(a.credit).toLocaleString()}` : "—"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2 font-bold">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right">৳{Number(trialBalance.total_debit).toLocaleString()}</TableCell>
                        <TableCell className="text-right">৳{Number(trialBalance.total_credit).toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </>
              ) : <p className="text-center text-muted-foreground py-8">No accounts with transactions</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet">
          <div className="space-y-4">
            {balanceSheet && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">As of: {balanceSheet.as_of}</p>
                  <Badge variant={balanceSheet.is_balanced ? "default" : "destructive"}>
                    {balanceSheet.is_balanced ? "Balanced" : "Imbalanced"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Assets */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm text-primary">Assets</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(balanceSheet.assets || []).map((a: any) => (
                          <div key={a.id} className="flex justify-between text-sm">
                            <span>{a.name} <span className="text-xs text-muted-foreground">({a.code})</span></span>
                            <span className="font-semibold">৳{Number(a.balance).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>Total Assets</span>
                          <span className="text-primary">৳{Number(balanceSheet.total_assets).toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Liabilities */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm text-destructive">Liabilities</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(balanceSheet.liabilities || []).map((a: any) => (
                          <div key={a.id} className="flex justify-between text-sm">
                            <span>{a.name} <span className="text-xs text-muted-foreground">({a.code})</span></span>
                            <span className="font-semibold">৳{Number(a.balance).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>Total Liabilities</span>
                          <span className="text-destructive">৳{Number(balanceSheet.total_liabilities).toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Equity */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Equity</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(balanceSheet.equity || []).map((a: any) => (
                          <div key={a.id} className="flex justify-between text-sm">
                            <span>{a.name} <span className="text-xs text-muted-foreground">({a.code})</span></span>
                            <span className="font-semibold">৳{Number(a.balance).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>Total Equity</span>
                          <span>৳{Number(balanceSheet.total_equity).toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
            {!balanceSheet && <p className="text-center text-muted-foreground py-8">Loading...</p>}
          </div>
        </TabsContent>

        {/* Account Balances */}
        <TabsContent value="accounts">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accountBalances && Object.entries(accountBalances).map(([type, data]: [string, any]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="text-sm capitalize flex items-center justify-between">
                    {type}
                    <Badge variant="outline">৳{Number(data.total).toLocaleString()}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(data.accounts || []).map((a: any) => (
                      <div key={a.id} className="flex justify-between text-sm">
                        <span>{a.name} <span className="text-xs text-muted-foreground">{a.code}</span></span>
                        <span className={`font-semibold ${Number(a.balance) < 0 ? "text-destructive" : ""}`}>৳{Number(a.balance).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!accountBalances && <p className="text-center text-muted-foreground py-8 col-span-2">Loading...</p>}
          </div>
        </TabsContent>

        {/* Receivable & Payable */}
        <TabsContent value="receivable">
          <div className="space-y-4">
            {receivablePayable && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MetricCard title="Total Receivable" value={`৳${Number(receivablePayable.total_receivable || 0).toLocaleString()}`} icon={TrendingUp} color="text-primary" />
                  <MetricCard title="Total Payable" value={`৳${Number(receivablePayable.total_payable || 0).toLocaleString()}`} icon={TrendingDown} color="text-destructive" />
                  <MetricCard title="Net Position" value={`৳${Number(receivablePayable.net_position || 0).toLocaleString()}`} icon={DollarSign} color={receivablePayable.net_position >= 0 ? "text-primary" : "text-destructive"} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Customer Receivables (Top 50)</CardTitle></CardHeader>
                    <CardContent>
                      {(receivablePayable.receivables || []).length > 0 ? (
                        <Table>
                          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Due</TableHead><TableHead className="text-right">Bills</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {receivablePayable.receivables.map((r: any) => (
                              <TableRow key={r.customer_id}>
                                <TableCell className="text-sm">{r.customer?.name || "—"}</TableCell>
                                <TableCell className="text-right font-semibold text-destructive">৳{Number(r.due_amount).toLocaleString()}</TableCell>
                                <TableCell className="text-right">{r.bill_count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : <p className="text-center text-muted-foreground py-4">No receivables</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Supplier Payables</CardTitle></CardHeader>
                    <CardContent>
                      {(receivablePayable.payables || []).length > 0 ? (
                        <Table>
                          <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Company</TableHead><TableHead className="text-right">Due</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {receivablePayable.payables.map((p: any) => (
                              <TableRow key={p.id}>
                                <TableCell className="text-sm">{p.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{p.company || "—"}</TableCell>
                                <TableCell className="text-right font-semibold text-destructive">৳{Number(p.total_due).toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : <p className="text-center text-muted-foreground py-4">No payables</p>}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Customers */}
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

        {/* Payments */}
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

        {/* Ledger */}
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

        {/* SMS */}
        <TabsContent value="sms">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Monthly SMS Usage</CardTitle></CardHeader>
              <CardContent>
                {smsData?.monthly?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[...smsData.monthly].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="SMS Sent" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-8">No SMS data</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">By Type</CardTitle></CardHeader>
              <CardContent>
                {smsData?.by_type?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={smsData.by_type} dataKey="count" nameKey="sms_type" cx="50%" cy="50%" outerRadius={80} label={({ sms_type, count }: any) => `${sms_type} (${count})`}>
                        {smsData.by_type.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-8">No data</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inventory">
          <div className="space-y-4">
            {inventoryData && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard title="Total Products" value={inventoryData.total_products || 0} icon={Package} />
                  <MetricCard title="Inventory Value" value={`৳${Number(inventoryData.total_value || 0).toLocaleString()}`} icon={DollarSign} color="text-primary" />
                  <MetricCard title="Low Stock" value={(inventoryData.low_stock || []).length} icon={AlertTriangle} color="text-yellow-600" />
                  <MetricCard title="Out of Stock" value={(inventoryData.out_of_stock || []).length} icon={AlertTriangle} color="text-destructive" />
                </div>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Product Inventory</CardTitle></CardHeader>
                  <CardContent>
                    {(inventoryData.products || []).length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Buy Price</TableHead>
                            <TableHead className="text-right">Sell Price</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inventoryData.products.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{p.sku || "—"}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={p.stock <= 0 ? "destructive" : p.stock <= 5 ? "secondary" : "default"}>{p.stock}</Badge>
                              </TableCell>
                              <TableCell className="text-right">৳{Number(p.buy_price).toLocaleString()}</TableCell>
                              <TableCell className="text-right">৳{Number(p.sell_price).toLocaleString()}</TableCell>
                              <TableCell className="text-right font-semibold">৳{(p.stock * p.buy_price).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : <p className="text-center text-muted-foreground py-8">No products</p>}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
