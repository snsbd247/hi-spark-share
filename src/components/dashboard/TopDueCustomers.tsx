import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  tenantCustomerIds: string[];
}

export default function TopDueCustomers({ tenantCustomerIds }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["top-due-customers", tenantCustomerIds.length],
    queryFn: async () => {
      if (tenantCustomerIds.length === 0) return [];
      const { data: bills } = await db
        .from("bills")
        .select("customer_id, amount, status, month")
        .in("customer_id", tenantCustomerIds)
        .eq("status", "unpaid");
      if (!bills || bills.length === 0) return [];
      // Aggregate by customer
      const agg: Record<string, { due: number; count: number }> = {};
      bills.forEach((b: any) => {
        if (!agg[b.customer_id]) agg[b.customer_id] = { due: 0, count: 0 };
        agg[b.customer_id].due += Number(b.amount || 0);
        agg[b.customer_id].count += 1;
      });
      const ids = Object.keys(agg);
      const { data: cust } = await db.from("customers").select("id, name, customer_id, phone").in("id", ids);
      return (cust || [])
        .map((c: any) => ({ ...c, due: agg[c.id].due, count: agg[c.id].count }))
        .sort((a, b) => b.due - a.due)
        .slice(0, 5);
    },
    enabled: tenantCustomerIds.length > 0,
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Top Due Customers
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <Link to="/customers?filter=due">View all <ArrowRight className="h-3 w-3" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">কোন বকেয়া নেই 🎉</p>
        ) : (
          <div className="space-y-2">
            {data.map((c: any, i: number) => (
              <Link key={c.id} to={`/customers/${c.id}`}
                className="flex items-center justify-between rounded-xl bg-muted/40 hover:bg-muted/70 px-3 py-2.5 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-warning/20 to-destructive/20 flex items-center justify-center text-xs font-bold text-warning shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.customer_id} · {c.count} বিল</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-destructive tabular-nums">৳{c.due.toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
