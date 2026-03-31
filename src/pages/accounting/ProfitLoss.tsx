import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

export default function ProfitLoss() {
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(0); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-pl"],
    queryFn: async () => { const { data } = await ( db as any).from("accounts").select("*").in("type", ["income", "expense"]).eq("is_active", true).order("code"); return data || []; },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions-pl", dateFrom, dateTo],
    queryFn: async () => {
      let q = ( db as any).from("transactions").select("account_id, debit, credit");
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo + "T23:59:59");
      const { data } = await q;
      return data || [];
    },
  });

  const incomeAccounts = accounts.filter((a: any) => a.type === "income");
  const expenseAccounts = accounts.filter((a: any) => a.type === "expense");

  const getBalance = (accId: string, type: string) => {
    const entries = transactions.filter((t: any) => t.account_id === accId);
    const debit = entries.reduce((s: number, t: any) => s + Number(t.debit || 0), 0);
    const credit = entries.reduce((s: number, t: any) => s + Number(t.credit || 0), 0);
    return type === "income" ? credit - debit : debit - credit;
  };

  const incomeData = incomeAccounts.map((a: any) => ({ ...a, balance: getBalance(a.id, "income") })).filter((a: any) => a.balance !== 0);
  const expenseData = expenseAccounts.map((a: any) => ({ ...a, balance: getBalance(a.id, "expense") })).filter((a: any) => a.balance !== 0);

  const totalIncome = incomeData.reduce((s: number, a: any) => s + a.balance, 0);
  const totalExpense = expenseData.reduce((s: number, a: any) => s + a.balance, 0);
  const netProfit = totalIncome - totalExpense;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Profit & Loss Account</h1>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4">
              <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" /></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div><p className="text-xs text-muted-foreground">Total Income</p><p className="text-xl font-bold text-green-600">{fmt(totalIncome)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div><p className="text-xs text-muted-foreground">Total Expense</p><p className="text-xl font-bold text-destructive">{fmt(totalExpense)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${netProfit >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                <DollarSign className={`h-5 w-5 ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`} />
              </div>
              <div><p className="text-xs text-muted-foreground">Net {netProfit >= 0 ? "Profit" : "Loss"}</p>
                <p className={`text-xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(netProfit)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income */}
          <Card>
            <CardHeader><CardTitle className="text-green-600">Income</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {incomeData.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-sm">{a.code}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{fmt(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {incomeData.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No income entries</TableCell></TableRow>}
                  <TableRow className="font-bold bg-muted/30 border-t-2">
                    <TableCell colSpan={2} className="text-right">Total Income</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{fmt(totalIncome)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Expense */}
          <Card>
            <CardHeader><CardTitle className="text-destructive">Expenses</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {expenseData.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-sm">{a.code}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{fmt(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {expenseData.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No expense entries</TableCell></TableRow>}
                  <TableRow className="font-bold bg-muted/30 border-t-2">
                    <TableCell colSpan={2} className="text-right">Total Expenses</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{fmt(totalExpense)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Net Result */}
        <Card className={netProfit >= 0 ? "border-green-300 dark:border-green-800" : "border-destructive/30"}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">Net {netProfit >= 0 ? "Profit" : "Loss"}</span>
              <span className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(netProfit)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
