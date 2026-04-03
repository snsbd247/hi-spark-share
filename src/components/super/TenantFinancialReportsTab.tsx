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

    </div>
  );
}
