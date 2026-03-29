import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scale } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function BalanceSheet() {
  const { t } = useLanguage();
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0]);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts-balance-sheet"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("accounts").select("*").eq("is_active", true).order("code");
      return data || [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["all-txn-for-bs", asOf],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transactions").select("account_id, debit, credit").lte("date", asOf + "T23:59:59");
      return data || [];
    },
  });

  // Compute balances from transactions
  const balanceMap = new Map<string, number>();
  transactions.forEach((t: any) => {
    if (!t.account_id) return;
    balanceMap.set(t.account_id, (balanceMap.get(t.account_id) || 0) + Number(t.debit || 0) - Number(t.credit || 0));
  });

  const getBalance = (acc: any) => {
    const raw = balanceMap.get(acc.id) || 0;
    return ["asset", "expense"].includes(acc.type) ? raw : -raw;
  };

  const byType = (type: string) => accounts.filter((a: any) => a.type === type);
  const sumType = (type: string) => byType(type).reduce((s, a: any) => s + getBalance(a), 0);

  const totalAssets = sumType("asset");
  const totalLiabilities = sumType("liability");
  const totalEquity = sumType("equity");
  const retainedEarnings = sumType("income") - sumType("expense");
  const totalLE = totalLiabilities + totalEquity + retainedEarnings;

  const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Scale className="h-6 w-6" /> Balance Sheet</h1>
            <p className="text-muted-foreground text-sm">Assets = Liabilities + Equity</p>
          </div>
          <div>
            <Label className="text-xs">As of Date</Label>
            <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-44" />
          </div>
        </div>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-green-600">Assets</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {byType("asset").map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.code && <code className="text-xs bg-muted px-1 rounded mr-2">{a.code}</code>}{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(getBalance(a))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/30">
                      <TableCell>Total Assets</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totalAssets)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-destructive">Liabilities & Equity</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {byType("liability").map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.code && <code className="text-xs bg-muted px-1 rounded mr-2">{a.code}</code>}{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(getBalance(a))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total Liabilities</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totalLiabilities)}</TableCell>
                    </TableRow>
                    {byType("equity").map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.code && <code className="text-xs bg-muted px-1 rounded mr-2">{a.code}</code>}{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(getBalance(a))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="italic">Retained Earnings</TableCell>
                      <TableCell className="text-right font-mono">{fmt(retainedEarnings)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold bg-muted/30">
                      <TableCell>Total Liabilities & Equity</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totalLE)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Balance Check</p>
                    <p className="text-lg font-bold">
                      Assets ({fmt(totalAssets)}) = Liabilities + Equity ({fmt(totalLE)})
                    </p>
                  </div>
                  <Badge variant={Math.abs(totalAssets - totalLE) < 0.01 ? "default" : "destructive"}>
                    {Math.abs(totalAssets - totalLE) < 0.01 ? "✓ Balanced" : "✗ Unbalanced"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
