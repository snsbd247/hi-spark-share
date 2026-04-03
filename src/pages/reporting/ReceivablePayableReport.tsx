import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import ReportToolbar from "@/components/reports/ReportToolbar";

export default function ReceivablePayableReport() {
  const { data: customers = [] } = useQuery({
    queryKey: ["rp-customers"], queryFn: async () => { const { data } = await db.from("customers").select("id, name, customer_id, area"); return data || []; },
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["rp-bills"], queryFn: async () => { const { data } = await db.from("bills").select("customer_id, amount, paid_amount, status, month"); return data || []; },
  });

  const unpaid = bills.filter((b: any) => b.status !== "paid");
  const receivableMap: Record<string, { name: string; customer_id: string; area: string; due: number; bills: number }> = {};
  unpaid.forEach((b: any) => {
    const cust = customers.find((c: any) => c.id === b.customer_id);
    if (!receivableMap[b.customer_id]) receivableMap[b.customer_id] = { name: cust?.name || "Unknown", customer_id: cust?.customer_id || "", area: cust?.area || "", due: 0, bills: 0 };
    receivableMap[b.customer_id].due += Number(b.amount || 0) - Number(b.paid_amount || 0);
    receivableMap[b.customer_id].bills++;
  });

  const receivables = Object.values(receivableMap).filter(r => r.due > 0).sort((a, b) => b.due - a.due);
  const totalReceivable = receivables.reduce((s, r) => s + r.due, 0);

  const columns = [
    { header: "Customer ID", key: "customer_id" },
    { header: "Name", key: "name" },
    { header: "Area", key: "area" },
    { header: "Unpaid Bills", key: "bills" },
    { header: "Due Amount", key: "due", format: (v: number) => `Tk ${v.toLocaleString()}` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><AlertTriangle className="h-6 w-6" /> Receivable / Payable</h1>
          <p className="text-muted-foreground text-sm">Outstanding customer dues and payable summary</p>
        </div>

        <ReportToolbar title="Receivable Payable Report" data={receivables} columns={columns} showDateFilter={false} />

        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Total Receivable</p><p className="text-2xl font-bold text-destructive">৳{totalReceivable.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Customers with Due</p><p className="text-2xl font-bold">{receivables.length}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top Receivables</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Unpaid Bills</TableHead>
                  <TableHead className="text-right">Due Amount (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.slice(0, 50).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.customer_id}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.area}</TableCell>
                    <TableCell className="text-right">{r.bills}</TableCell>
                    <TableCell className="text-right font-bold text-destructive">৳{r.due.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
