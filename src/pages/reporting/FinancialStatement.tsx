import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import ReportToolbar from "@/components/reports/ReportToolbar";

export default function FinancialStatement() {
  const { t } = useLanguage();
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => { const { data } = await (db as any).from("accounts").select("*").order("code"); return data || []; },
  });

  const byType = (tp: string) => accounts.filter((a: any) => a.type === tp);
  const sumType = (tp: string) => byType(tp).reduce((s: number, a: any) => s + Number(a.balance), 0);

  const totalIncome = sumType("income");
  const totalExpense = sumType("expense");
  const netProfit = totalIncome - totalExpense;

  const tableData = accounts.map((a: any) => ({
    code: a.code || "",
    name: a.name,
    type: a.type,
    balance: Number(a.balance || 0),
  }));

  const columns = [
    { header: "Code", key: "code" },
    { header: "Account", key: "name" },
    { header: "Type", key: "type" },
    { header: "Balance", key: "balance", format: (v: number) => `Tk ${v.toLocaleString()}` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">{t.sidebar.financialStatement}</h1></div>

        <ReportToolbar title="Financial Statement" data={tableData} columns={columns} showDateFilter={false} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-primary">৳{totalIncome.toLocaleString()}</div><p className="text-sm text-muted-foreground">Total Income</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">৳{totalExpense.toLocaleString()}</div><p className="text-sm text-muted-foreground">Total Expense</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className={`text-2xl font-bold ${netProfit >= 0 ? "text-primary" : "text-destructive"}`}>৳{netProfit.toLocaleString()}</div><p className="text-sm text-muted-foreground">Net Profit/Loss</p></CardContent></Card>
        </div>

        {["income", "expense", "asset", "liability", "equity"].map((type) => (
          <Card key={type}>
            <CardHeader><CardTitle className="capitalize">{type}s (৳{sumType(type).toLocaleString()})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Balance (৳)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byType(type).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="text-right">{Number(a.balance || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
