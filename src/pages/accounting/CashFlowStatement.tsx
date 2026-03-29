import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";

const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

export default function CashFlowStatement() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(0); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const { data: transactions = [] } = useQuery({
    queryKey: ["cashflow-txns", dateFrom, dateTo],
    queryFn: async () => {
      let q = ( supabase as any).from("transactions").select("*, account:accounts(name, code, type)");
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo + "T23:59:59");
      const { data } = await q.order("date", { ascending: true });
      return data || [];
    },
  });

  // Dynamically detect cash/bank accounts: asset accounts with code starting "110" or "11", or names containing Cash/Bank
  const isCashAccount = (acc: any) => {
    if (!acc) return false;
    if (acc.type !== "asset") return false;
    const code = acc.code || "";
    const name = (acc.name || "").toLowerCase();
    return code.startsWith("110") || code.startsWith("11") || name.includes("cash") || name.includes("bank") || name.includes("bkash") || name.includes("nagad");
  };

  // Receipts: Debits to cash/bank accounts
  const receipts = transactions.filter((t: any) => isCashAccount(t.account) && Number(t.debit) > 0);

  // Payments: Credits from cash/bank accounts
  const payments = transactions.filter((t: any) => isCashAccount(t.account) && Number(t.credit) > 0);

  const totalReceipts = receipts.reduce((s: number, t: any) => s + Number(t.debit), 0);
  const totalPayments = payments.reduce((s: number, t: any) => s + Number(t.credit), 0);
  const netCashFlow = totalReceipts - totalPayments;

  // Group receipts by description pattern
  const groupByDesc = (items: any[], field: "debit" | "credit") => {
    const groups = new Map<string, number>();
    items.forEach(t => {
      const key = t.account?.name || "Other";
      groups.set(key, (groups.get(key) || 0) + Number(t[field]));
    });
    return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
  };

  const receiptGroups = groupByDesc(receipts, "debit");
  const paymentGroups = groupByDesc(payments, "credit");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Statement of Cash Flow</h1>

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
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><ArrowDownRight className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-xs text-muted-foreground">Total Receipts</p><p className="text-xl font-bold text-green-600">{fmt(totalReceipts)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><ArrowUpRight className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-xs text-muted-foreground">Total Payments</p><p className="text-xl font-bold text-destructive">{fmt(totalPayments)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${netCashFlow >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                <Wallet className={`h-5 w-5 ${netCashFlow >= 0 ? "text-green-600" : "text-destructive"}`} />
              </div>
              <div><p className="text-xs text-muted-foreground">Net Cash Flow</p>
                <p className={`text-xl font-bold ${netCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(netCashFlow)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-green-600">Cash Receipts</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {receiptGroups.map(([name, amount]) => (
                    <TableRow key={name}><TableCell className="font-medium">{name}</TableCell><TableCell className="text-right font-mono text-green-600">{fmt(amount)}</TableCell></TableRow>
                  ))}
                  {receiptGroups.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground">No receipts</TableCell></TableRow>}
                  <TableRow className="font-bold bg-muted/30 border-t-2">
                    <TableCell className="text-right">Total</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{fmt(totalReceipts)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-destructive">Cash Payments</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paymentGroups.map(([name, amount]) => (
                    <TableRow key={name}><TableCell className="font-medium">{name}</TableCell><TableCell className="text-right font-mono text-destructive">{fmt(amount)}</TableCell></TableRow>
                  ))}
                  {paymentGroups.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground">No payments</TableCell></TableRow>}
                  <TableRow className="font-bold bg-muted/30 border-t-2">
                    <TableCell className="text-right">Total</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{fmt(totalPayments)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
