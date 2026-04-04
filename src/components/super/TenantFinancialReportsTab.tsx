import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/superAdminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, DollarSign, MessageSquare, Wifi, WifiOff,
  UserX, TrendingUp, CircleDollarSign, TicketCheck
} from "lucide-react";

function StatCard({ title, value, icon: Icon, iconBg = "bg-primary/10", iconColor = "text-primary", subtitle }: {
  title: string; value: string | number; icon: any; iconBg?: string; iconColor?: string; subtitle?: string;
}) {
  return (
    <Card className="border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
        </div>
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
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(11)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const o = overview || {};

  return (
    <div className="space-y-3">
      {/* Row 1: Customer Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Total Customers" value={o.total_customers || 0} icon={Users} iconBg="bg-primary/10" iconColor="text-primary" />
        <StatCard title="Active" value={o.active_customers || 0} icon={Users} iconBg="bg-primary/10" iconColor="text-primary" />
        <StatCard title="Suspended" value={o.suspended_customers || 0} icon={UserX} iconBg="bg-destructive/10" iconColor="text-destructive" />
        <StatCard title="Online Now" value={o.online_customers || 0} icon={Wifi} iconBg="bg-green-100" iconColor="text-green-600" />
        <StatCard title="Offline Now" value={o.offline_customers || 0} icon={WifiOff} iconBg="bg-amber-100" iconColor="text-amber-600" />
        <StatCard title="Support Tickets" value={o.support_tickets || 0} icon={TicketCheck} iconBg="bg-primary/10" iconColor="text-primary" />
      </div>

      {/* Row 2: Financial Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Month Collection" value={`৳${Number(o.monthly_revenue || 0).toLocaleString()}`} icon={CircleDollarSign} iconBg="bg-primary/10" iconColor="text-primary" />
        <StatCard title="Total Due" value={`৳${Number(o.total_due || 0).toLocaleString()}`} icon={DollarSign} iconBg="bg-primary/10" iconColor="text-primary" />
        <StatCard title="All-Time Due" value={`৳${Number(o.alltime_due || 0).toLocaleString()}`} icon={DollarSign} iconBg="bg-amber-100" iconColor="text-amber-600" />
        <StatCard title="Total Collection" value={`৳${Number(o.total_revenue || 0).toLocaleString()}`} icon={TrendingUp} iconBg="bg-primary/10" iconColor="text-primary" />
        <StatCard title="SMS Balance" value={o.sms_balance ?? "—"} icon={MessageSquare} iconBg="bg-primary/10" iconColor="text-primary" subtitle="Assigned by Super Admin" />
      </div>
    </div>
  );
}
