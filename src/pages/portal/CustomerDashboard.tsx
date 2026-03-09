import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { fetchCustomerData } from "@/hooks/useCustomerData";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  AlertCircle,
  Package,
  Wifi,
  WifiOff,
  CreditCard,
  Loader2,
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function StatCard({ title, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <Card className="glass-card animate-fade-in">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 text-card-foreground">{value}</p>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${bgColor}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerDashboard() {
  const { customer } = useCustomerAuth();

  const { data: pkg } = useQuery({
    queryKey: ["customer-package", customer?.package_id],
    queryFn: async () => {
      if (!customer?.package_id) return null;
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("id", customer.package_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!customer?.package_id,
  });

  const { data: portalData, isLoading } = useQuery({
    queryKey: ["customer-dashboard-data", customer?.id],
    queryFn: async () => {
      const result = await fetchCustomerData(customer!.session_token, {
        include_bills: true,
        include_payments: true,
      });
      return result;
    },
    enabled: !!customer,
  });

  const bills = portalData?.bills || [];
  const lastPayment = portalData?.payments?.[0] || null;

  const currentBill = bills?.[0];
  const totalDue = bills
    ?.filter((b) => b.status === "unpaid")
    .reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;

  const connectionStatus = (customer as any)?.connection_status || customer?.status || "active";
  const isConnected = connectionStatus === "active";

  const statusColor =
    customer?.status === "active"
      ? "bg-success/10 text-success border-success/20"
      : customer?.status === "suspended"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-muted text-muted-foreground border-border";

  const connectionColor = isConnected
    ? "bg-success/10 text-success border-success/20"
    : "bg-destructive/10 text-destructive border-destructive/20";

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome, {customer?.name}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-muted-foreground font-mono text-sm">{customer?.customer_id}</p>
          <Badge variant="outline" className={statusColor}>
            {customer?.status}
          </Badge>
          <Badge variant="outline" className={connectionColor}>
            {isConnected ? "Online" : "Suspended (Due Bill)"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Current Bill"
          value={currentBill ? `৳${Number(currentBill.amount).toLocaleString()}` : "—"}
          icon={Receipt}
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <StatCard
          title="Total Due"
          value={`৳${totalDue.toLocaleString()}`}
          icon={AlertCircle}
          color="text-destructive"
          bgColor="bg-destructive/10"
        />
        <StatCard
          title="Package"
          value={pkg?.name ?? "—"}
          icon={Package}
          color="text-accent"
          bgColor="bg-accent/10"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="glass-card animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isConnected ? "bg-success/10" : "bg-destructive/10"}`}>
                {isConnected ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-destructive" />}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Connection Status</p>
                <p className={`text-lg font-bold capitalize ${isConnected ? "text-success" : "text-destructive"}`}>
                  {isConnected ? "Active" : "Suspended (Due Bill)"}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speed</span>
                <span className="font-medium text-foreground">{pkg?.speed ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Bill</span>
                <span className="font-medium text-foreground">৳{customer?.monthly_bill.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Payment</p>
                <p className="text-lg font-bold text-card-foreground">
                  {lastPayment ? `৳${Number(lastPayment.amount).toLocaleString()}` : "No payments yet"}
                </p>
              </div>
            </div>
            {lastPayment && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium text-foreground">
                    {new Date(lastPayment.paid_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium text-foreground capitalize">{lastPayment.payment_method}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
