import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, UserX, DollarSign, AlertCircle, Loader2, Wifi, WifiOff, RefreshCw, Wallet } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";

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
            <p className="text-3xl font-bold mt-1 text-card-foreground">{value}</p>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${bgColor}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [runningBillControl, setRunningBillControl] = useState(false);

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["customers-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, status, monthly_bill, connection_status");
      if (error) throw error;
      return data;
    },
  });

  const { data: bills, isLoading: loadingBills } = useQuery({
    queryKey: ["bills-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("id, amount, status");
      if (error) throw error;
      return data;
    },
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: merchantPayments, isLoading: loadingMerchant } = useQuery({
    queryKey: ["merchant-payments-today", todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_payments")
        .select("id, amount, status")
        .gte("created_at", `${todayStr}T00:00:00`)
        .lte("created_at", `${todayStr}T23:59:59`);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingCustomers || loadingBills;

  const total = customers?.length ?? 0;
  const active = customers?.filter((c) => c.status === "active").length ?? 0;
  const suspended = customers?.filter((c) => c.status === "suspended").length ?? 0;
  const onlineUsers = customers?.filter((c) => c.connection_status === "active").length ?? 0;
  const suspendedConn = customers?.filter((c) => c.connection_status === "suspended").length ?? 0;
  const monthlyRevenue = bills?.filter((b) => b.status === "paid").reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;
  const totalDue = bills?.filter((b) => b.status === "unpaid").reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;

  const merchantTotal = merchantPayments?.length ?? 0;
  const merchantMatched = merchantPayments?.filter((p) => p.status === "matched").length ?? 0;
  const merchantReview = merchantPayments?.filter((p) => p.status === "manual_review").length ?? 0;
  const merchantUnmatched = merchantPayments?.filter((p) => p.status === "unmatched").length ?? 0;
  const merchantAmount = merchantPayments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const runBillControl = async () => {
    setRunningBillControl(true);
    try {
      const { data, error } = await supabase.functions.invoke("mikrotik-sync/bill-control", { body: {} });
      if (error) throw error;
      const r = data?.results;
      toast.success(`Bill control completed: ${r?.suspended || 0} suspended, ${r?.reactivated || 0} reactivated`);
    } catch (e: any) {
      toast.error("Bill control failed: " + (e.message || "Unknown error"));
    } finally {
      setRunningBillControl(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to Smart ISP Admin Panel</p>
        </div>
        <Button variant="outline" onClick={runBillControl} disabled={runningBillControl}>
          {runningBillControl ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run Bill Control
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Customers" value={total} icon={Users} color="text-primary" bgColor="bg-primary/10" />
        <StatCard title="Active Customers" value={active} icon={UserCheck} color="text-success" bgColor="bg-success/10" />
        <StatCard title="Suspended" value={suspended} icon={UserX} color="text-destructive" bgColor="bg-destructive/10" />
        <StatCard title="Monthly Revenue" value={`৳${monthlyRevenue.toLocaleString()}`} icon={DollarSign} color="text-accent" bgColor="bg-accent/10" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Online Users" value={onlineUsers} icon={Wifi} color="text-success" bgColor="bg-success/10" />
        <StatCard title="Suspended Connections" value={suspendedConn} icon={WifiOff} color="text-destructive" bgColor="bg-destructive/10" />
        <StatCard title="Total Due" value={`৳${totalDue.toLocaleString()}`} icon={AlertCircle} color="text-warning" bgColor="bg-warning/10" />
      </div>

      {/* Merchant Payments Today Widget */}
      <Card className="glass-card animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Today's Merchant Payments
            </CardTitle>
            <span className="text-sm text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMerchant ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : merchantTotal === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No merchant payments received today</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{merchantTotal}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg bg-success/10 p-3 text-center">
                  <p className="text-2xl font-bold text-success">{merchantMatched}</p>
                  <p className="text-xs text-muted-foreground">Matched</p>
                </div>
                <div className="rounded-lg bg-warning/10 p-3 text-center">
                  <p className="text-2xl font-bold text-warning">{merchantReview}</p>
                  <p className="text-xs text-muted-foreground">Review</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{merchantUnmatched}</p>
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="text-lg font-bold text-foreground">৳{merchantAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}