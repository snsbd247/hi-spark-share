import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt } from "lucide-react";
import { format } from "date-fns";

export default function ResellerBilling() {
  const { reseller } = useResellerAuth();

  // Get customer IDs first, then bills
  const { data: customerIds = [] } = useQuery({
    queryKey: ["reseller-customer-ids", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any)
        .from("customers")
        .select("id")
        .eq("reseller_id", reseller!.id);
      return (data || []).map((c: any) => c.id);
    },
    enabled: !!reseller?.id,
  });

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["reseller-bills", customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      const { data, error } = await (db as any)
        .from("bills")
        .select("*, customers(name, customer_id)")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: customerIds.length > 0,
  });

  const statusColor = (s: string) => {
    if (s === "paid") return "default";
    if (s === "unpaid" || s === "overdue") return "destructive";
    return "secondary";
  };

  return (
    <ResellerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6 text-primary" /> Billing</h1>
          <p className="text-muted-foreground mt-1">View invoices for your customers</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : bills.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No bills found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.customers?.name} <span className="text-xs text-muted-foreground">({b.customers?.customer_id})</span></TableCell>
                        <TableCell>{b.month}</TableCell>
                        <TableCell>৳{b.amount}</TableCell>
                        <TableCell>৳{b.paid_amount || 0}</TableCell>
                        <TableCell><Badge variant={statusColor(b.status)}>{b.status}</Badge></TableCell>
                        <TableCell className="text-xs">{format(new Date(b.created_at), "dd MMM yyyy")}</TableCell>
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
