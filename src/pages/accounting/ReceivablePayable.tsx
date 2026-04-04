import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { safeFormat } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

function getAgingBucket(daysDue: number): string {
  if (daysDue <= 0) return "Current";
  if (daysDue <= 30) return "1-30 Days";
  if (daysDue <= 60) return "31-60 Days";
  if (daysDue <= 90) return "61-90 Days";
  return "90+ Days";
}

export default function ReceivablePayable() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const now = new Date();

  // Receivable: unpaid bills
  const { data: bills = [] } = useQuery({
    queryKey: ["receivable-bills", tenantId],
    queryFn: async () => {
      const { data } = await ( db as any).from("bills").select("*, customer:customers(name, customer_id, phone)").eq("status", "unpaid").order("due_date", { ascending: true });
      return data || [];
    },
  });

  // Payable: suppliers with due > 0
  const { data: purchases = [] } = useQuery({
    queryKey: ["payable-purchases", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant(( db as any).from("purchases").select("*, supplier:suppliers(name, company, phone)").order("date", { ascending: true }), tenantId);
      return data || [];
    },
  });

  const unpaidPurchases = purchases.filter((p: any) => Number(p.total_amount) > Number(p.paid_amount));

  // Aging analysis for receivables
  const receivableAging = bills.map((b: any) => {
    const dueDate = b.due_date ? new Date(b.due_date) : new Date(b.created_at);
    const daysDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return { ...b, daysDue, bucket: getAgingBucket(daysDue) };
  });

  const agingBuckets = ["Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days"];
  const receivableSummary = agingBuckets.map(bucket => ({
    bucket,
    count: receivableAging.filter(b => b.bucket === bucket).length,
    amount: receivableAging.filter(b => b.bucket === bucket).reduce((s: number, b: any) => s + Number(b.amount), 0),
  }));

  // Aging for payables
  const payableAging = unpaidPurchases.map((p: any) => {
    const purchaseDate = new Date(p.date);
    const daysDue = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const due = Number(p.total_amount) - Number(p.paid_amount);
    return { ...p, daysDue, bucket: getAgingBucket(daysDue), dueAmount: due };
  });

  const payableSummary = agingBuckets.map(bucket => ({
    bucket,
    count: payableAging.filter(p => p.bucket === bucket).length,
    amount: payableAging.filter(p => p.bucket === bucket).reduce((s: number, p: any) => s + p.dueAmount, 0),
  }));

  const totalReceivable = bills.reduce((s: number, b: any) => s + Number(b.amount), 0);
  const totalPayable = payableAging.reduce((s: number, p: any) => s + p.dueAmount, 0);

  const bucketColors: Record<string, string> = {
    "Current": "text-green-600", "1-30 Days": "text-yellow-600",
    "31-60 Days": "text-orange-600", "61-90 Days": "text-red-500", "90+ Days": "text-destructive",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Bills Receivable & Payable</h1>

        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Receivable</p><p className="text-xl font-bold text-blue-600">{fmt(totalReceivable)}</p><p className="text-xs text-muted-foreground">{bills.length} unpaid bills</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Payable</p><p className="text-xl font-bold text-destructive">{fmt(totalPayable)}</p><p className="text-xs text-muted-foreground">{unpaidPurchases.length} unpaid purchases</p></CardContent></Card>
        </div>

        <Tabs defaultValue="receivable">
          <TabsList>
            <TabsTrigger value="receivable">Receivable ({bills.length})</TabsTrigger>
            <TabsTrigger value="payable">Payable ({unpaidPurchases.length})</TabsTrigger>
            <TabsTrigger value="aging">Aging Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="receivable">
            <Card>
              <CardHeader><CardTitle>Bills Receivable</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Aging</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivableAging.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div><span className="font-medium">{b.customer?.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{b.customer?.customer_id}</span></div>
                        </TableCell>
                        <TableCell>{b.month}</TableCell>
                        <TableCell>{b.due_date || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className={bucketColors[b.bucket]}>{b.bucket}</Badge></TableCell>
                        <TableCell className="text-right font-mono font-semibold">{fmt(Number(b.amount))}</TableCell>
                      </TableRow>
                    ))}
                    {bills.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No outstanding bills</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payable">
            <Card>
              <CardHeader><CardTitle>Bills Payable (Supplier)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Purchase No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Aging</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payableAging.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.supplier?.name || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{p.purchase_no}</TableCell>
                        <TableCell>{safeFormat(p.date, "dd MMM yyyy")}</TableCell>
                        <TableCell><Badge variant="outline" className={bucketColors[p.bucket]}>{p.bucket}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(p.total_amount))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(p.paid_amount))}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-destructive">{fmt(p.dueAmount)}</TableCell>
                      </TableRow>
                    ))}
                    {unpaidPurchases.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No outstanding payables</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aging">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Receivable Aging</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="text-center">Count</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {receivableSummary.map(s => (
                        <TableRow key={s.bucket}>
                          <TableCell className={`font-medium ${bucketColors[s.bucket]}`}>{s.bucket}</TableCell>
                          <TableCell className="text-center">{s.count}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(s.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/30 border-t-2">
                        <TableCell>Total</TableCell><TableCell className="text-center">{bills.length}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(totalReceivable)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Payable Aging</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="text-center">Count</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {payableSummary.map(s => (
                        <TableRow key={s.bucket}>
                          <TableCell className={`font-medium ${bucketColors[s.bucket]}`}>{s.bucket}</TableCell>
                          <TableCell className="text-center">{s.count}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(s.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/30 border-t-2">
                        <TableCell>Total</TableCell><TableCell className="text-center">{unpaidPurchases.length}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(totalPayable)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
