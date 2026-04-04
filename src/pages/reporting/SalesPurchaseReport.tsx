import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

export default function SalesPurchaseReport() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const { data: sales = [] } = useQuery({
    queryKey: ["sales-report", dateFrom, dateTo, tenantId],
    queryFn: async () => {
      let q = ( db as any).from("sales").select("*");
      if (dateFrom) q = q.gte("sale_date", dateFrom);
      if (dateTo) q = q.lte("sale_date", dateTo);
      const { data } = await q.order("sale_date", { ascending: false });
      return data || [];
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases-report", dateFrom, dateTo, tenantId],
    queryFn: async () => {
      let q = ( db as any).from("purchases").select("*, supplier:suppliers(name)");
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo + "T23:59:59");
      const { data } = await q.order("date", { ascending: false });
      return data || [];
    },
  });

  const totalSales = sales.reduce((s: number, x: any) => s + Number(x.total || 0), 0);
  const totalSalesPaid = sales.reduce((s: number, x: any) => s + Number(x.paid_amount || 0), 0);
  const totalPurchases = purchases.reduce((s: number, x: any) => s + Number(x.total_amount || 0), 0);
  const totalPurchasesPaid = purchases.reduce((s: number, x: any) => s + Number(x.paid_amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t.sidebar.salesPurchase}</h1>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4">
              <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" /></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Sales</p><p className="text-lg font-bold text-green-600">{fmt(totalSales)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Sales Received</p><p className="text-lg font-bold">{fmt(totalSalesPaid)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Purchases</p><p className="text-lg font-bold text-destructive">{fmt(totalPurchases)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Purchase Paid</p><p className="text-lg font-bold">{fmt(totalPurchasesPaid)}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger>
            <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <Card>
              <CardHeader><CardTitle>Sales Report</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Sale No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>{safeFormat(s.sale_date, "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-mono">{s.sale_no}</TableCell>
                        <TableCell>{s.customer_name || "—"}</TableCell>
                        <TableCell className="capitalize">{s.payment_method}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(s.total))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(s.paid_amount))}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{fmt(Number(s.total) - Number(s.paid_amount))}</TableCell>
                        <TableCell><Badge variant={s.status === "completed" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {sales.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No sales found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases">
            <Card>
              <CardHeader><CardTitle>Purchase Report</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Purchase No</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{safeFormat(p.date, "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-mono">{p.purchase_no}</TableCell>
                        <TableCell>{p.supplier?.name || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(p.total_amount))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(p.paid_amount))}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{fmt(Number(p.total_amount) - Number(p.paid_amount))}</TableCell>
                        <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {purchases.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchases found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
