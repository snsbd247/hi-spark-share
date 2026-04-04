import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, Receipt, TrendingUp, Loader2 } from "lucide-react";

export default function ResellerDashboard() {
  const { reseller } = useResellerAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["reseller-dashboard", reseller?.id],
    queryFn: async () => {
      const [custRes, walletRes] = await Promise.all([
        (db as any).from("customers").select("id, monthly_bill, connection_status").eq("reseller_id", reseller!.id),
        (db as any).from("resellers").select("wallet_balance").eq("id", reseller!.id).single(),
      ]);
      const customers = custRes.data || [];
      const totalCustomers = customers.length;
      const activeCustomers = customers.filter((c: any) => c.connection_status === "online").length;
      const totalRevenue = customers.reduce((sum: number, c: any) => sum + (parseFloat(c.monthly_bill) || 0), 0);
      const walletBalance = parseFloat(walletRes.data?.wallet_balance) || 0;
      return { totalCustomers, activeCustomers, totalRevenue, walletBalance };
    },
    enabled: !!reseller?.id,
  });

  const cards = [
    { title: "Total Customers", value: stats?.totalCustomers || 0, icon: Users, color: "text-blue-500" },
    { title: "Active Customers", value: stats?.activeCustomers || 0, icon: TrendingUp, color: "text-emerald-500" },
    { title: "Monthly Revenue", value: `৳${(stats?.totalRevenue || 0).toLocaleString()}`, icon: Receipt, color: "text-amber-500" },
    { title: "Wallet Balance", value: `৳${(stats?.walletBalance || 0).toLocaleString()}`, icon: Wallet, color: "text-purple-500" },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ResellerLayout>
  );
}
