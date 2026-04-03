import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Users, DollarSign, Receipt, MessageSquare,
  BarChart3
} from "lucide-react";

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
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["tenant-report-overview", tenantId],
    queryFn: () => superAdminApi.getTenantReportOverview(tenantId),
    enabled: !!tenantId,
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
