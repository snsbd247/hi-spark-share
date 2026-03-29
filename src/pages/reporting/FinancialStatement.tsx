import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FinancialStatement() {
  const { t } = useLanguage();
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ["accounts"], queryFn: async () => { const { data } = await ( supabase as any).from("accounts").select("*").order("code"); return data || []; } });

  const byType = (t: string) => accounts.filter((a: any) => a.type === t);
  const sumType = (t: string) => byType(t).reduce((s: number, a: any) => s + Number(a.balance), 0);

  const totalIncome = sumType("income");
  const totalExpense = sumType("expense");
  const netProfit = totalIncome - totalExpense;

  return (
    <DashboardLayout>
      <div className="mb-6"><h1 className="text-2xl font-bold">Financial Statement</h1></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">৳{totalIncome.toLocaleString()}</div><p className="text-sm text-muted-foreground">Total Income</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">৳{totalExpense.toLocaleString()}</div><p className="text-sm text-muted-foreground">Total Expense</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>৳{netProfit.toLocaleString()}</div><p className="text-sm text-muted-foreground">Net Profit/Loss</p></CardContent></Card>
      </div>
      {["income", "expense", "asset", "liability", "equity"].map((type) => (
        <Card key={type} className="mb-4">
          <CardHeader><CardTitle className="capitalize">{type}s (৳{sumType(type).toLocaleString()})</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-center py-4 text-muted-foreground">{t.common.loading}</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byType(type).map((a: any) => (
                    <TableRow key={a.id}><TableCell className="font-mono">{a.code}</TableCell><TableCell className="font-medium">{a.name}</TableCell><TableCell className="text-right font-semibold">৳{Number(a.balance).toLocaleString()}</TableCell></TableRow>
                  ))}
                  {byType(type).length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No {type} accounts</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </DashboardLayout>
  );
}
