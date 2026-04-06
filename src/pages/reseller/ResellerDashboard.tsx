import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Wallet, Receipt, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import StatCards from "@/components/reseller/dashboard/StatCards";
import WalletChart from "@/components/reseller/dashboard/WalletChart";
import StatusPieChart from "@/components/reseller/dashboard/StatusPieChart";
import RecentTransactions from "@/components/reseller/dashboard/RecentTransactions";

export default function ResellerDashboard() {
  const { reseller } = useResellerAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["reseller-dashboard", reseller?.id],
    queryFn: async () => {
      const [custRes, walletRes, txnRes, commBillsRes] = await Promise.all([
        (db as any).from("customers").select("id, monthly_bill, connection_status, status, created_at").eq("reseller_id", reseller!.id),
        (db as any).from("resellers").select("wallet_balance, commission_rate, default_commission").eq("id", reseller!.id).single(),
        (db as any).from("reseller_wallet_transactions").select("type, amount, created_at").eq("reseller_id", reseller!.id).order("created_at", { ascending: false }).limit(50),
        (db as any).from("bills").select("amount, commission_amount, reseller_profit, tenant_amount").eq("reseller_id", reseller!.id),
      ]);

      const customers = custRes.data || [];
      const totalCustomers = customers.length;
      const activeCustomers = customers.filter((c: any) => c.connection_status === "online").length;
      const inactiveCustomers = customers.filter((c: any) => c.connection_status === "offline").length;
      const totalRevenue = customers.reduce((sum: number, c: any) => sum + (parseFloat(c.monthly_bill) || 0), 0);
      const walletBalance = parseFloat(walletRes.data?.wallet_balance) || 0;
      const defaultCommission = parseFloat(walletRes.data?.default_commission) || 0;
      const transactions = txnRes.data || [];

      const commBills = commBillsRes.data || [];
      const totalProfit = commBills.reduce((s: number, b: any) => s + (parseFloat(b.reseller_profit) || 0), 0);

      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const newThisMonth = customers.filter((c: any) => c.created_at?.startsWith(thisMonth)).length;

      const statusData = [
        { name: "Active", value: activeCustomers },
        { name: "Inactive", value: inactiveCustomers },
        { name: "Other", value: totalCustomers - activeCustomers - inactiveCustomers },
      ].filter(d => d.value > 0);

      const monthlyMap: Record<string, { credit: number; debit: number }> = {};
      transactions.forEach((t: any) => {
        const m = t.created_at?.slice(0, 7);
        if (!monthlyMap[m]) monthlyMap[m] = { credit: 0, debit: 0 };
        if (t.type === "credit") monthlyMap[m].credit += parseFloat(t.amount) || 0;
        else monthlyMap[m].debit += parseFloat(t.amount) || 0;
      });
      const monthlyChart = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, val]) => ({ month: month.slice(5), credit: val.credit, debit: val.debit }));

      const recentTxns = transactions.slice(0, 5);

      let unpaidBills = 0;
      if (customers.length > 0) {
        const custIds = customers.map((c: any) => c.id);
        const { data: billData } = await (db as any)
          .from("bills").select("id").in("customer_id", custIds).in("status", ["unpaid", "overdue"]);
        unpaidBills = billData?.length || 0;
      }

      return { totalCustomers, activeCustomers, totalRevenue, walletBalance, defaultCommission, totalProfit, newThisMonth, statusData, monthlyChart, recentTxns, unpaidBills };
    },
    enabled: !!reseller?.id,
  });

  const cards = [
    { title: "Total Customers", value: stats?.totalCustomers || 0, icon: Users, change: `${stats?.newThisMonth || 0} new this month` },
    { title: "Active Customers", value: stats?.activeCustomers || 0, icon: TrendingUp, change: `${stats?.totalCustomers ? Math.round(((stats?.activeCustomers || 0) / stats.totalCustomers) * 100) : 0}% active rate` },
    { title: "Total Profit", value: `৳${(stats?.totalProfit || 0).toLocaleString()}`, icon: Receipt, change: `Commission: ৳${stats?.defaultCommission || 0}/customer` },
    { title: "Wallet Balance", value: `৳${(stats?.walletBalance || 0).toLocaleString()}`, icon: Wallet, change: stats?.walletBalance && stats.walletBalance < 500 ? "Low balance!" : "Available" },
  ];

  return (
    <ResellerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {reseller?.name}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <StatCards cards={cards} />

            {stats?.unpaidBills && stats.unpaidBills > 0 && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="pt-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <p className="text-sm"><strong>{stats.unpaidBills}</strong> unpaid/overdue bills from your customers.</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <WalletChart data={stats?.monthlyChart || []} />
              <StatusPieChart data={stats?.statusData || []} />
            </div>

            <RecentTransactions transactions={stats?.recentTxns || []} />
          </>
        )}
      </div>
    </ResellerLayout>
  );
}
