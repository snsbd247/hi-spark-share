import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";

export default function ResellerWallet() {
  const { reseller } = useResellerAuth();

  const { data: walletData } = useQuery({
    queryKey: ["reseller-wallet-balance", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any).from("resellers").select("wallet_balance").eq("id", reseller!.id).single();
      return data;
    },
    enabled: !!reseller?.id,
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["reseller-wallet-txns", reseller?.id],
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("reseller_wallet_transactions")
        .select("*")
        .eq("reseller_id", reseller!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!reseller?.id,
  });

  const balance = parseFloat(walletData?.wallet_balance) || 0;

  return (
    <ResellerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> Wallet</h1>
          <p className="text-muted-foreground mt-1">Your wallet balance and transaction history</p>
        </div>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-4xl font-bold text-primary mt-1">৳{balance.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No transactions yet</p>
            ) : (
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
                          <Badge variant={t.type === "credit" ? "default" : "destructive"} className="gap-1">
                            {t.type === "credit" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {t.type}
                          </Badge>
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
            )}
          </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
}
