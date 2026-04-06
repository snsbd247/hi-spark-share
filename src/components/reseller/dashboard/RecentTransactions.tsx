import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Transaction {
  type: string;
  amount: string;
  created_at: string;
}

export default function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent Wallet Transactions</CardTitle></CardHeader>
      <CardContent>
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((t, i) => (
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
  );
}
