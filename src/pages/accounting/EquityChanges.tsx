import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

export default function EquityChanges() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(0); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const { data: equityAccounts = [] } = useQuery({
    queryKey: ["equity-accounts", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant(( db as any).from("accounts").select("*").eq("type", "equity").eq("is_active", true).order("code"), tenantId); return data || []; },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["equity-txns", dateFrom, dateTo, tenantId],
    queryFn: async () => {
      const equityIds = equityAccounts.map((a: any) => a.id);
      if (equityIds.length === 0) return [];
      let q = ( db as any).from("transactions").select("*").in("account_id", equityIds);
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo + "T23:59:59");
      const { data } = await q.order("date");
      return data || [];
    },
    enabled: equityAccounts.length > 0,
  });

  // Also get income & expense for retained earnings calc
  const { data: incExpAccounts = [] } = useQuery({
    queryKey: ["inc-exp-accounts", tenantId],
    queryFn: async () => { const { data } = await scopeByTenant(( db as any).from("accounts").select("id, type").in("type", ["income", "expense"]).eq("is_active", true), tenantId); return data || []; },
  });

  const { data: incExpTxns = [] } = useQuery({
    queryKey: ["inc-exp-txns", dateFrom, dateTo, tenantId],
    queryFn: async () => {
      const ids = incExpAccounts.map((a: any) => a.id);
      if (ids.length === 0) return [];
      let q = ( db as any).from("transactions").select("account_id, debit, credit").in("account_id", ids);
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo + "T23:59:59");
      const { data } = await q;
      return data || [];
    },
    enabled: incExpAccounts.length > 0,
  });

  // Calculate net income
  const incomeIds = new Set(incExpAccounts.filter((a: any) => a.type === "income").map((a: any) => a.id));
  const totalIncome = incExpTxns.filter((t: any) => incomeIds.has(t.account_id)).reduce((s: number, t: any) => s + Number(t.credit || 0) - Number(t.debit || 0), 0);
  const totalExpense = incExpTxns.filter((t: any) => !incomeIds.has(t.account_id)).reduce((s: number, t: any) => s + Number(t.debit || 0) - Number(t.credit || 0), 0);
  const netIncome = totalIncome - totalExpense;

  // Equity account movements
  const equityData = equityAccounts.map((acc: any) => {
    const accTxns = transactions.filter((t: any) => t.account_id === acc.id);
    const totalCredit = accTxns.reduce((s: number, t: any) => s + Number(t.credit || 0), 0);
    const totalDebit = accTxns.reduce((s: number, t: any) => s + Number(t.debit || 0), 0);
    const netChange = totalCredit - totalDebit;
    return { ...acc, totalCredit, totalDebit, netChange };
  });

  const totalEquityChange = equityData.reduce((s: number, a: any) => s + a.netChange, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Statement of Changes in Equity</h1>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4">
              <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" /></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Net Income (Period)</p><p className={`text-xl font-bold ${netIncome >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(netIncome)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Equity Movement</p><p className="text-xl font-bold">{fmt(totalEquityChange)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Equity Accounts</p><p className="text-xl font-bold">{equityAccounts.length}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Equity Account Changes</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead className="text-right">Period Debit</TableHead>
                  <TableHead className="text-right">Period Credit</TableHead>
                  <TableHead className="text-right">Net Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equityData.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.code}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(a.balance))}</TableCell>
                    <TableCell className="text-right font-mono">{a.totalDebit > 0 ? fmt(a.totalDebit) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{a.totalCredit > 0 ? fmt(a.totalCredit) : "—"}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${a.netChange >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(a.netChange)}</TableCell>
                  </TableRow>
                ))}
                {equityAccounts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No equity accounts found</TableCell></TableRow>}

                {/* Retained earnings from P&L */}
                <TableRow className="bg-muted/20">
                  <TableCell className="font-mono text-sm">—</TableCell>
                  <TableCell className="font-medium italic">Retained Earnings (Net Income)</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className={`text-right font-mono font-semibold ${netIncome >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(netIncome)}</TableCell>
                </TableRow>

                <TableRow className="font-bold bg-muted/30 border-t-2">
                  <TableCell colSpan={5} className="text-right">Total Changes in Equity</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totalEquityChange + netIncome)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
