import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, TrendingUp, Users, Wallet } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function ResellerReports() {
  const { reseller } = useResellerAuth();

  const { data: customers = [], isLoading: loadingCust } = useQuery({
    queryKey: ["reseller-report-customers", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any)
        .from("customers")
        .select("id, customer_id, name, phone, area, monthly_bill, connection_status, created_at, packages(name, price)")
        .eq("reseller_id", reseller!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!reseller?.id,
  });

  const { data: transactions = [], isLoading: loadingTxn } = useQuery({
    queryKey: ["reseller-report-txns", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any)
        .from("reseller_wallet_transactions")
        .select("*")
        .eq("reseller_id", reseller!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!reseller?.id,
  });

  // Sales summary
  const totalSales = customers.reduce((s: number, c: any) => s + (parseFloat(c.monthly_bill) || 0), 0);
  const totalBaseCost = customers.reduce((s: number, c: any) => s + (parseFloat(c.packages?.price) || 0), 0);
  const totalProfit = totalSales - totalBaseCost;

  // Monthly sales chart
  const monthlyMap: Record<string, number> = {};
  customers.forEach((c: any) => {
    const m = c.created_at?.slice(0, 7);
    if (m) monthlyMap[m] = (monthlyMap[m] || 0) + 1;
  });
  const monthlySales = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month: month.slice(5), customers: count }));

  // Wallet summary
  const totalCredit = transactions.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);
  const totalDebit = transactions.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);

  const isLoading = loadingCust || loadingTxn;

  return (
    <ResellerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Reports</h1>
          <p className="text-muted-foreground mt-1">Sales, profit, and wallet reports</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="sales">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sales"><TrendingUp className="h-4 w-4 mr-1.5" />Sales</TabsTrigger>
              <TabsTrigger value="customers"><Users className="h-4 w-4 mr-1.5" />Customers</TabsTrigger>
              <TabsTrigger value="wallet"><Wallet className="h-4 w-4 mr-1.5" />Wallet</TabsTrigger>
            </TabsList>

            {/* Sales Report */}
            <TabsContent value="sales" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary mt-1">৳{totalSales.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Base Cost</p>
                    <p className="text-2xl font-bold mt-1">৳{totalBaseCost.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Profit (Margin)</p>
                    <p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>৳{totalProfit.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">New Customers by Month</CardTitle></CardHeader>
                <CardContent>
                  {monthlySales.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthlySales}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Bar dataKey="customers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No data</p>
                  )}
                </CardContent>
              </Card>

              {/* Profit per customer table */}
              <Card>
                <CardHeader><CardTitle className="text-base">Profit per Customer</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Base Price</TableHead>
                          <TableHead>Selling Price</TableHead>
                          <TableHead>Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.slice(0, 50).map((c: any) => {
                          const base = parseFloat(c.packages?.price) || 0;
                          const sell = parseFloat(c.monthly_bill) || 0;
                          const profit = sell - base;
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell>{c.packages?.name || "—"}</TableCell>
                              <TableCell>৳{base}</TableCell>
                              <TableCell>৳{sell}</TableCell>
                              <TableCell className={profit >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>৳{profit}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Customer List Report */}
            <TabsContent value="customers" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{customers.length}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Online</p><p className="text-xl font-bold text-primary">{customers.filter((c: any) => c.connection_status === "online").length}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Offline</p><p className="text-xl font-bold text-destructive">{customers.filter((c: any) => c.connection_status === "offline").length}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Monthly Rev.</p><p className="text-xl font-bold">৳{totalSales.toLocaleString()}</p></CardContent></Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Area</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Bill</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.customer_id}</TableCell>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell>{c.phone}</TableCell>
                            <TableCell>{c.area}</TableCell>
                            <TableCell>{c.packages?.name || "—"}</TableCell>
                            <TableCell>৳{c.monthly_bill}</TableCell>
                            <TableCell><Badge variant={c.connection_status === "online" ? "default" : "secondary"}>{c.connection_status}</Badge></TableCell>
                            <TableCell className="text-xs">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wallet Report */}
            <TabsContent value="wallet" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Credit</p>
                    <p className="text-2xl font-bold text-primary mt-1">৳{totalCredit.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Debit</p>
                    <p className="text-2xl font-bold text-destructive mt-1">৳{totalDebit.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Net Flow</p>
                    <p className={`text-2xl font-bold mt-1 ${totalCredit - totalDebit >= 0 ? "text-primary" : "text-destructive"}`}>
                      ৳{(totalCredit - totalDebit).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">All Transactions</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Balance After</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell>
                              <Badge variant={t.type === "credit" ? "default" : "destructive"}>{t.type}</Badge>
                            </TableCell>
                            <TableCell className={t.type === "credit" ? "text-primary font-medium" : "text-destructive font-medium"}>
                              {t.type === "credit" ? "+" : "-"}৳{parseFloat(t.amount).toLocaleString()}
                            </TableCell>
                            <TableCell>৳{parseFloat(t.balance_after).toLocaleString()}</TableCell>
                            <TableCell>{t.description || "—"}</TableCell>
                            <TableCell className="text-xs">{format(new Date(t.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ResellerLayout>
  );
}
