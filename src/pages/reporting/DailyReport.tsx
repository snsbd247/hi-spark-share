import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportToolbar from "@/components/reports/ReportToolbar";
import { useTenantCustomerIds } from "@/hooks/useTenantCustomerIds";

export default function DailyReport() {
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const { customerIds, tenantId } = useTenantCustomerIds();

  const { data: payments = [] } = useQuery({
    queryKey: ["daily-payments", dateFrom, dateTo, tenantId],
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      let q: any = (db as any).from("payments").select("*").gte("paid_at", `${dateFrom}T00:00:00`).lte("paid_at", `${dateTo}T23:59:59`);
      if (customerIds.length > 0) q = q.in("customer_id", customerIds);
      const { data } = await q; return data || [];
    }, enabled: customerIds.length > 0,
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["daily-bills", dateFrom, dateTo, tenantId],
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      let q: any = (db as any).from("bills").select("*").gte("created_at", `${dateFrom}T00:00:00`).lte("created_at", `${dateTo}T23:59:59`);
      if (customerIds.length > 0) q = q.in("customer_id", customerIds);
      const { data } = await q; return data || [];
    }, enabled: customerIds.length > 0,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-summary", tenantId],
    queryFn: async () => {
      let q: any = (db as any).from("customers").select("*");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q; return data || [];
    },
  });

  const totalCollection = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalBilled = bills.reduce((s: number, b: any) => s + Number(b.amount), 0);
  const activeCustomers = customers.filter((c: any) => c.status === "active").length;
  const inactiveCustomers = customers.filter((c: any) => c.status !== "active").length;

  const summaryData = [
    { metric: t.dailyReport.totalCollection, value: totalCollection },
    { metric: t.dailyReport.billsGenerated, value: totalBilled },
    { metric: t.dailyReport.activeCustomers, value: activeCustomers },
    { metric: t.dailyReport.inactiveCustomers, value: inactiveCustomers },
  ];

  const paymentData = payments.map((p: any) => ({
    method: p.payment_method || "cash",
    amount: Number(p.amount || 0),
    date: (p.paid_at || p.created_at)?.substring(0, 10) || "",
  }));

  const columns = [
    { header: t.common.date, key: "date" },
    { header: t.dailyReport.paymentMethod, key: "method" },
    { header: t.common.amount, key: "amount", format: (v: number) => `Tk ${v.toLocaleString()}` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">{t.dailyReport.title}</h1></div>

        <ReportToolbar
          title={t.dailyReport.title}
          data={paymentData}
          columns={columns}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-primary">৳{totalCollection.toLocaleString()}</div><p className="text-sm text-muted-foreground">{t.dailyReport.totalCollection}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-accent-foreground">৳{totalBilled.toLocaleString()}</div><p className="text-sm text-muted-foreground">{t.dailyReport.billsGenerated}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-primary">{activeCustomers}</div><p className="text-sm text-muted-foreground">{t.dailyReport.activeCustomers}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{inactiveCustomers}</div><p className="text-sm text-muted-foreground">{t.dailyReport.inactiveCustomers}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>{t.sidebar.payments} ({payments.length})</CardTitle></CardHeader>
            <CardContent>
              {payments.length === 0 ? <p className="text-center py-8 text-muted-foreground">{t.dailyReport.noPayments}</p> : (
                <div className="space-y-2">{payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span className="text-sm">{p.payment_method}</span>
                    <span className="font-semibold">৳{Number(p.amount).toLocaleString()}</span>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t.sidebar.billing} ({bills.length})</CardTitle></CardHeader>
            <CardContent>
              {bills.length === 0 ? <p className="text-center py-8 text-muted-foreground">{t.dailyReport.noBillsGenerated}</p> : (
                <div className="space-y-2">{bills.map((b: any) => (
                  <div key={b.id} className="flex justify-between items-center p-2 rounded bg-muted/50">
                    <span className="text-sm">{b.month}</span>
                    <span className="font-semibold">৳{Number(b.amount).toLocaleString()}</span>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
