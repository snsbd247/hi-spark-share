import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileDown, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LedgerStatement() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const accountId = searchParams.get("account_id") || "";
  const accountName = searchParams.get("name") || "Account";
  const accountCode = searchParams.get("code") || "";

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  // Get account info
  const { data: account } = useQuery({
    queryKey: ["account-detail", accountId, tenantId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data } = await ( db as any).from("accounts").select("*").eq("id", accountId).maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  // Get opening balance from transactions before dateFrom
  const { data: openingData } = useQuery({
    queryKey: ["ledger-opening", accountId, dateFrom, tenantId],
    queryFn: async () => {
      if (!accountId || !dateFrom) return { debit: 0, credit: 0 };
      const { data } = await (db as any).from("transactions").select("debit, credit").eq("account_id", accountId).lt("date", dateFrom);
      const debit = (data || []).reduce((s: number, t: any) => s + Number(t.debit || 0), 0);
      const credit = (data || []).reduce((s: number, t: any) => s + Number(t.credit || 0), 0);
      return { debit, credit };
    },
    enabled: !!accountId,
  });

  // Get all transactions for this account in the period
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["ledger-statement", accountId, dateFrom, dateTo, tenantId],
    queryFn: async () => {
      if (!accountId) return [];
      let query = (db as any).from("transactions").select("*").eq("account_id", accountId);
      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo + "T23:59:59");
      const { data } = await query.order("date", { ascending: true }).order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!accountId,
  });

  // Calculate running balance with proper opening balance
  const isDebitNormal = ["asset", "expense"].includes(account?.type || "");
  const openingBalance = isDebitNormal
    ? (openingData?.debit || 0) - (openingData?.credit || 0)
    : (openingData?.credit || 0) - (openingData?.debit || 0);

  const totalDebit = transactions.reduce((s: number, t: any) => s + Number(t.debit || 0), 0);
  const totalCredit = transactions.reduce((s: number, t: any) => s + Number(t.credit || 0), 0);

  // Build rows with running balance starting from opening balance
  let runningBalance = openingBalance;
  const rows = transactions.map((t: any) => {
    const debit = Number(t.debit || 0);
    const credit = Number(t.credit || 0);
    if (isDebitNormal) {
      runningBalance += debit - credit;
    } else {
      runningBalance += credit - debit;
    }
    return { ...t, running_balance: runningBalance };
  });

  const closingBalance = runningBalance;

  const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/accounting/chart-of-accounts")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-6 w-6" />
                Ledger Statement
              </h1>
              <p className="text-muted-foreground text-sm">
                {accountCode && <code className="bg-muted px-1.5 py-0.5 rounded text-xs mr-2">{accountCode}</code>}
                {accountName}
                {account && <Badge variant="outline" className="ml-2 capitalize">{account.type}</Badge>}
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4">
              <div>
                <Label className="text-xs">From Date</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">To Date</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Opening Balance</p>
              <p className="text-lg font-bold">{fmt(openingBalance)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total Debit</p>
              <p className="text-lg font-bold text-blue-600">{fmt(totalDebit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total Credit</p>
              <p className="text-lg font-bold text-green-600">{fmt(totalCredit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Closing Balance</p>
              <p className={`text-lg font-bold ${closingBalance >= 0 ? "" : "text-destructive"}`}>{fmt(closingBalance)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Transactions ({transactions.length} entries)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No transactions found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {rows.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm">{safeFormat(t.date, "dd MMM yyyy")}</TableCell>
                          <TableCell className="font-medium">{t.description}</TableCell>
                          <TableCell>
                            {t.reference ? <Badge variant="outline" className="text-xs">{t.reference}</Badge> : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(t.debit) > 0 ? fmt(Number(t.debit)) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(t.credit) > 0 ? fmt(Number(t.credit)) : "—"}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${t.running_balance < 0 ? "text-destructive" : ""}`}>
                            {fmt(t.running_balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="font-bold bg-muted/30 border-t-2">
                        <TableCell colSpan={3} className="text-right">Total</TableCell>
                        <TableCell className="text-right font-mono text-blue-600">{fmt(totalDebit)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{fmt(totalCredit)}</TableCell>
                        <TableCell className={`text-right font-mono ${closingBalance < 0 ? "text-destructive" : ""}`}>
                          {fmt(closingBalance)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
