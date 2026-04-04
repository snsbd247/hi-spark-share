import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, Receipt, TrendingUp, Loader2, ArrowUpRight, ArrowDownRight, UserPlus, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const STATUS_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

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
      const commissionRate = parseFloat(walletRes.data?.commission_rate) || 0;
      const defaultCommission = parseFloat(walletRes.data?.default_commission) || 0;
      const transactions = txnRes.data || [];

      // Commission profit from bills
      const commBills = commBillsRes.data || [];
      const totalProfit = commBills.reduce((s: number, b: any) => s + (parseFloat(b.reseller_profit) || 0), 0);
      const totalTenantAmount = commBills.reduce((s: number, b: any) => s + (parseFloat(b.tenant_amount) || 0), 0);

      // New customers this month
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const newThisMonth = customers.filter((c: any) => c.created_at?.startsWith(thisMonth)).length;

      // Status pie chart
      const statusData = [
        { name: "Active", value: activeCustomers },
        { name: "Inactive", value: inactiveCustomers },
        { name: "Other", value: totalCustomers - activeCustomers - inactiveCustomers },
      ].filter(d => d.value > 0);

      // Monthly revenue chart (last 6 months from transactions)
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

      // Recent transactions
      const recentTxns = transactions.slice(0, 5);

      // Unpaid bills count - reuse custRes instead of extra query
      let unpaidBills = 0;
      if (customers.length > 0) {
        const custIds = customers.map((c: any) => c.id);
        const { data: billData } = await (db as any)
          .from("bills")
          .select("id")
          .in("customer_id", custIds)
          .in("status", ["unpaid", "overdue"]);
        unpaidBills = billData?.length || 0;
      }

      return { totalCustomers, activeCustomers, totalRevenue, walletBalance, commissionRate, defaultCommission, totalProfit, totalTenantAmount, newThisMonth, statusData, monthlyChart, recentTxns, unpaidBills };
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
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((card) => (
                <Card key={card.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                    <card.icon className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.change}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Alert for unpaid bills */}
            {stats?.unpaidBills && stats.unpaidBills > 0 && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="pt-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <p className="text-sm"><strong>{stats.unpaidBills}</strong> unpaid/overdue bills from your customers.</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Wallet Chart */}
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Wallet Activity (Last 6 Months)</CardTitle></CardHeader>
                <CardContent>
                  {(stats?.monthlyChart?.length || 0) > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={stats!.monthlyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Bar dataKey="credit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Credit" />
                        <Bar dataKey="debit" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Debit" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No transaction data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Status Pie */}
              <Card>
                <CardHeader><CardTitle className="text-base">Customer Status</CardTitle></CardHeader>
                <CardContent>
                  {(stats?.statusData?.length || 0) > 0 ? (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={stats!.statusData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                            {stats!.statusData.map((_: any, i: number) => (
                              <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 mt-2">
                        {stats!.statusData.map((d: any, i: number) => (
                          <div key={d.name} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                            <span className="text-muted-foreground">{d.name}: {d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No customers yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Wallet Transactions</CardTitle></CardHeader>
              <CardContent>
                {(stats?.recentTxns?.length || 0) > 0 ? (
                  <div className="space-y-3">
                    {stats!.recentTxns.map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          {t.type === "credit" ? (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><ArrowUpRight className="h-4 w-4 text-primary" /></div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center"><ArrowDownRight className="h-4 w-4 text-destructive" /></div>
                          )}
                          <div>
                            <p className="text-sm font-medium capitalize">{t.type}</p>
                            <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <p className={`font-semibold text-sm ${t.type === "credit" ? "text-primary" : "text-destructive"}`}>
                          {t.type === "credit" ? "+" : "-"}৳{parseFloat(t.amount).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No transactions yet</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ResellerLayout>
  );
}
