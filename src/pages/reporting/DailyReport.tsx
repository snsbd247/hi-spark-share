import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/integrations/db/client";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DailyReport() {
  const { t } = useLanguage();
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: payments = [] } = useQuery({ queryKey: ["daily-payments"], queryFn: async () => { const { data } = await ( db as any).from("payments").select("*").gte("paid_at", `${today}T00:00:00`).lte("paid_at", `${today}T23:59:59`); return data || []; } });
  const { data: bills = [] } = useQuery({ queryKey: ["daily-bills"], queryFn: async () => { const { data } = await ( db as any).from("bills").select("*").gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`); return data || []; } });
  const { data: customers = [] } = useQuery({ queryKey: ["customers-summary"], queryFn: async () => { const { data } = await ( db as any).from("customers").select("*"); return data || []; } });

  const totalCollection = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalBilled = bills.reduce((s: number, b: any) => s + Number(b.amount), 0);
  const activeCustomers = customers.filter((c: any) => c.status === "active").length;
  const inactiveCustomers = customers.filter((c: any) => c.status !== "active").length;

  return (
    <DashboardLayout>
      <div className="mb-6"><h1 className="text-2xl font-bold">Daily Report — {today}</h1></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">৳{totalCollection.toLocaleString()}</div><p className="text-sm text-muted-foreground">Today's Collection</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-blue-600">৳{totalBilled.toLocaleString()}</div><p className="text-sm text-muted-foreground">Bills Generated</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-primary">{activeCustomers}</div><p className="text-sm text-muted-foreground">Active Customers</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{inactiveCustomers}</div><p className="text-sm text-muted-foreground">Inactive Customers</p></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Today's Payments ({payments.length})</CardTitle></CardHeader>
          <CardContent>
            {payments.length === 0 ? <p className="text-center py-8 text-muted-foreground">No payments today</p> : (
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
          <CardHeader><CardTitle>Today's Bills ({bills.length})</CardTitle></CardHeader>
          <CardContent>
            {bills.length === 0 ? <p className="text-center py-8 text-muted-foreground">No bills generated today</p> : (
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
    </DashboardLayout>
  );
}
