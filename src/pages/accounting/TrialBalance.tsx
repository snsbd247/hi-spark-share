import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

export default function TrialBalance() {
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 12);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-tb"],
    queryFn: async () => { const { data } = await ( supabase as any).from("accounts").select("*").eq("is_active", true).order("code"); return data || []; },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions-tb", dateFrom, dateTo],
    queryFn: async () => {
      let q = ( supabase as any).from("transactions").select("account_id, debit, credit, date");
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo + "T23:59:59");
      const { data } = await q;
      return data || [];
    },
  });

  // Opening balance transactions (before dateFrom)
  const { data: openingTxns = [] } = useQuery({
    queryKey: ["transactions-opening", dateFrom],
    queryFn: async () => {
      if (!dateFrom) return [];
      const { data } = await ( supabase as any).from("transactions").select("account_id, debit, credit").lt("date", dateFrom);
      return data || [];
    },
  });

  // Compute balances per account
  const accountData = accounts.map((acc: any) => {
    const isDebitNormal = ["asset", "expense"].includes(acc.type);

    // Opening balance
    const openingEntries = openingTxns.filter((t: any) => t.account_id === acc.id);
    const openingDebit = openingEntries.reduce((s: number, t: any) => s + Number(t.debit || 0), 0);
    const openingCredit = openingEntries.reduce((s: number, t: any) => s + Number(t.credit || 0), 0);
    const openingBalance = isDebitNormal ? openingDebit - openingCredit : openingCredit - openingDebit;

    // Period transactions
    const periodEntries = transactions.filter((t: any) => t.account_id === acc.id);
    const periodDebit = periodEntries.reduce((s: number, t: any) => s + Number(t.debit || 0), 0);
    const periodCredit = periodEntries.reduce((s: number, t: any) => s + Number(t.credit || 0), 0);

    // Closing balance
    const closingBalance = isDebitNormal
      ? openingBalance + periodDebit - periodCredit
      : openingBalance + periodCredit - periodDebit;

    return {
      ...acc,
      openingBalance,
      periodDebit,
      periodCredit,
      closingBalance,
      closingDebit: closingBalance > 0 ? closingBalance : 0,
      closingCredit: closingBalance < 0 ? Math.abs(closingBalance) : 0,
    };
  }).filter((a: any) => a.openingBalance !== 0 || a.periodDebit !== 0 || a.periodCredit !== 0);

  // Group by type
  const groupedByType = accountData.reduce((acc: any, item: any) => {
    (acc[item.type] = acc[item.type] || []).push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const totalDebit = accountData.reduce((s: number, a: any) => s + a.closingDebit, 0);
  const totalCredit = accountData.reduce((s: number, a: any) => s + a.closingCredit, 0);
  const totalPeriodDebit = accountData.reduce((s: number, a: any) => s + a.periodDebit, 0);
  const totalPeriodCredit = accountData.reduce((s: number, a: any) => s + a.periodCredit, 0);

  const typeOrder = ["asset", "liability", "equity", "income", "expense"];
  const typeLabels: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: t.sidebar.expenses };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Trial Balance</h1>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4">
              <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" /></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Active Accounts</p><p className="text-lg font-bold">{accountData.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Period Debit</p><p className="text-lg font-bold text-blue-600">{fmt(totalPeriodDebit)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Period Credit</p><p className="text-lg font-bold text-green-600">{fmt(totalPeriodCredit)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Balance Match</p>
            <p className={`text-lg font-bold ${Math.abs(totalDebit - totalCredit) < 0.01 ? "text-green-600" : "text-destructive"}`}>
              {Math.abs(totalDebit - totalCredit) < 0.01 ? "✓ Balanced" : `Diff: ${fmt(totalDebit - totalCredit)}`}
            </p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="ledger">
          <TabsList>
            <TabsTrigger value="ledger">Ledger Wise</TabsTrigger>
            <TabsTrigger value="group">Group Wise</TabsTrigger>
            <TabsTrigger value="opening">With Opening</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger">
            <Card>
              <CardHeader><CardTitle>Trial Balance - Ledger Wise</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountData.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm">{a.code}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.type}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{a.closingDebit > 0 ? fmt(a.closingDebit) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{a.closingCredit > 0 ? fmt(a.closingCredit) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/30 border-t-2">
                      <TableCell colSpan={3} className="text-right">Total</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">{fmt(totalDebit)}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{fmt(totalCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="group">
            <Card>
              <CardHeader><CardTitle>Trial Balance - Group Wise</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead className="text-right">Total Debit</TableHead>
                      <TableHead className="text-right">Total Credit</TableHead>
                      <TableHead className="text-right">Net Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeOrder.filter(t => groupedByType[t]).map(t => {
                      const items = groupedByType[t];
                      const gDebit = items.reduce((s: number, a: any) => s + a.closingDebit, 0);
                      const gCredit = items.reduce((s: number, a: any) => s + a.closingCredit, 0);
                      return (
                        <TableRow key={t}>
                          <TableCell className="font-medium capitalize">{typeLabels[t]} ({items.length} accounts)</TableCell>
                          <TableCell className="text-right font-mono">{gDebit > 0 ? fmt(gDebit) : "—"}</TableCell>
                          <TableCell className="text-right font-mono">{gCredit > 0 ? fmt(gCredit) : "—"}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(gDebit - gCredit)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold bg-muted/30 border-t-2">
                      <TableCell className="text-right">Total</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">{fmt(totalDebit)}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{fmt(totalCredit)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totalDebit - totalCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opening">
            <Card>
              <CardHeader><CardTitle>Trial Balance - With Opening Balance</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountData.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm">{a.code}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(a.openingBalance)}</TableCell>
                        <TableCell className="text-right font-mono">{a.periodDebit > 0 ? fmt(a.periodDebit) : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{a.periodCredit > 0 ? fmt(a.periodCredit) : "—"}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${a.closingBalance < 0 ? "text-destructive" : ""}`}>{fmt(a.closingBalance)}</TableCell>
                      </TableRow>
                    ))}
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
