import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Scale } from "lucide-react";
import ReportToolbar from "@/components/reports/ReportToolbar";

export default function TrialBalanceReport() {
  const { data: accounts = [] } = useQuery({
    queryKey: ["trial-balance-accounts"],
    queryFn: async () => { const { data } = await (db as any).from("accounts").select("*").order("code"); return data || []; },
  });

  const active = accounts.filter((a: any) => a.is_active !== false);
  const items = active.map((a: any) => ({
    code: a.code, name: a.name, type: a.type,
    debit: ["asset", "expense"].includes(a.type) ? Math.max(Number(a.balance || 0), 0) : 0,
    credit: ["liability", "equity", "income"].includes(a.type) ? Math.max(Number(a.balance || 0), 0) : 0,
  }));

  const totalDebit = items.reduce((s: any, i: any) => s + i.debit, 0);
  const totalCredit = items.reduce((s: any, i: any) => s + i.credit, 0);

  const columns = [
    { header: "Code", key: "code" },
    { header: "Account Name", key: "name" },
    { header: "Type", key: "type" },
    { header: "Debit", key: "debit", format: (v: number) => v > 0 ? `Tk ${v.toLocaleString()}` : "-" },
    { header: "Credit", key: "credit", format: (v: number) => v > 0 ? `Tk ${v.toLocaleString()}` : "-" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Scale className="h-6 w-6" /> Trial Balance</h1>
          <p className="text-muted-foreground text-sm">Summary of all account balances</p>
        </div>

        <ReportToolbar title="Trial Balance" data={items} columns={columns} showDateFilter={false} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit (৳)</TableHead>
                  <TableHead className="text-right">Credit (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell><span className="capitalize text-xs px-2 py-1 rounded bg-muted">{item.type}</span></TableCell>
                    <TableCell className="text-right">{item.debit > 0 ? item.debit.toLocaleString() : "-"}</TableCell>
                    <TableCell className="text-right">{item.credit > 0 ? item.credit.toLocaleString() : "-"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">৳{totalDebit.toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳{totalCredit.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
