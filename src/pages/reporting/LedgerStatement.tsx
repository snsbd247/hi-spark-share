import { useState, useMemo } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, FileDown, Printer, Search } from "lucide-react";
import { format } from "date-fns";
import { generateLedgerStatementPdf } from "@/lib/ledgerStatementPdf";
import { useBranding } from "@/contexts/TenantBrandingContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ReportLedgerStatement() {
  const { t } = useLanguage();
  const { branding } = useBranding();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear(), 0, 1); // Start of current year
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all accounts for dropdown
  const { data: accounts = [] } = useQuery({
    queryKey: ["all-accounts-for-ledger"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("accounts")
        .select("id, name, code, type, balance")
        .eq("is_active", true)
        .order("code", { ascending: true });
      return data || [];
    },
  });

  const selectedAccount = accounts.find((a: any) => a.id === selectedAccountId);

  // Fetch transactions for selected account
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["report-ledger-statement", selectedAccountId, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      let query = (supabase as any)
        .from("transactions")
        .select("*")
        .eq("account_id", selectedAccountId);
      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo + "T23:59:59");
      const { data } = await query
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedAccountId,
  });

  const isDebitNormal = ["asset", "expense"].includes(selectedAccount?.type || "");

  // Build rows with running balance and serial numbers
  const rows = useMemo(() => {
    let runningBalance = 0;
    const filtered = transactions.filter((t: any) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (t.description || "").toLowerCase().includes(q) ||
        (t.reference || "").toLowerCase().includes(q) ||
        (t.type || "").toLowerCase().includes(q)
      );
    });

    return filtered.map((t: any, idx: number) => {
      const debit = Number(t.debit || 0);
      const credit = Number(t.credit || 0);
      runningBalance += isDebitNormal ? debit - credit : credit - debit;
      return { ...t, sn: idx + 1, running_balance: runningBalance };
    });
  }, [transactions, isDebitNormal, searchQuery]);

  const totalDebit = rows.reduce((s: number, t: any) => s + Number(t.debit || 0), 0);
  const totalCredit = rows.reduce((s: number, t: any) => s + Number(t.credit || 0), 0);
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].running_balance : 0;

  const fmt = (v: number) =>
    v === 0 ? "0.00" : Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getVoucherType = (type: string) => {
    const map: Record<string, string> = {
      sale: t.sidebar.sales,
      purchase: "Purchase",
      expense: "Payment",
      receipt: "Receipt",
      payment: "Payment",
      journal: "Journal",
      transfer: "Transfer",
    };
    return map[type] || type || "—";
  };

  const handlePrint = () => {
    if (!selectedAccount || rows.length === 0) return;
    generateLedgerStatementPdf({
      accountName: selectedAccount.name,
      accountCode: selectedAccount.code || "",
      accountType: selectedAccount.type || "",
      dateFrom,
      dateTo,
      companyName: branding?.site_name || "Company",
      rows: rows.map((t: any) => ({
        sn: t.sn,
        date: safeFormat(t.date, "dd/MM/yyyy") || "",
        type: getVoucherType(t.type),
        reference: t.reference || "",
        description: t.description || "",
        note: t.journal_ref || "",
        debit: Number(t.debit || 0),
        credit: Number(t.credit || 0),
        running_balance: t.running_balance,
      })),
      totalDebit,
      totalCredit,
      closingBalance,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 print:space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Ledger Statement
            </h1>
            <p className="text-muted-foreground text-sm">
              Chart of Accounts থেকে যেকোনো লেজার এর স্টেটমেন্ট দেখুন
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!selectedAccountId}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="print:hidden">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <Label className="text-xs font-medium">Select Account / Ledger</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Select an account --" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc: any) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code ? `${acc.code} - ` : ""}{acc.name}
                        <span className="text-muted-foreground ml-1 text-xs">({acc.type})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">From Date</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium">To Date</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            {selectedAccountId && (
              <div className="mt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by description, reference..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Print Header (visible only on print) */}
        <div className="hidden print:block text-center mb-4">
          <h2 className="text-xl font-bold">Ledger Statement</h2>
          {selectedAccount && (
            <p className="text-sm">
              Account: {selectedAccount.code ? `${selectedAccount.code} - ` : ""}{selectedAccount.name} ({selectedAccount.type})
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Period: {dateFrom} to {dateTo}
          </p>
        </div>

        {/* No account selected */}
        {!selectedAccountId && (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                উপরে থেকে একটি Account/Ledger সিলেক্ট করুন স্টেটমেন্ট দেখতে
              </p>
            </CardContent>
          </Card>
        )}

        {/* Statement Table */}
        {selectedAccountId && (
          <Card>
            <CardHeader className="pb-2 print:pb-1">
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                  {selectedAccount?.code && (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs mr-2 print:bg-transparent">{selectedAccount.code}</code>
                  )}
                  {selectedAccount?.name || "Account"} — Statement
                </span>
                <span className="text-sm font-normal text-muted-foreground print:hidden">
                  {rows.length} entries
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-50 dark:bg-orange-950/30 print:bg-orange-50">
                        <TableHead className="w-[50px] text-center font-bold text-orange-700 dark:text-orange-400">SN</TableHead>
                        <TableHead className="w-[100px] font-bold text-orange-700 dark:text-orange-400">Vch. Date</TableHead>
                        <TableHead className="w-[90px] font-bold text-orange-700 dark:text-orange-400">Vch Type</TableHead>
                        <TableHead className="w-[120px] font-bold text-orange-700 dark:text-orange-400">Ref No</TableHead>
                        <TableHead className="font-bold text-orange-700 dark:text-orange-400">Particulars</TableHead>
                        <TableHead className="w-[200px] font-bold text-orange-700 dark:text-orange-400">Note</TableHead>
                        <TableHead className="w-[110px] text-right font-bold text-orange-700 dark:text-orange-400">Debit</TableHead>
                        <TableHead className="w-[110px] text-right font-bold text-orange-700 dark:text-orange-400">Credit</TableHead>
                        <TableHead className="w-[120px] text-right font-bold text-orange-700 dark:text-orange-400">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            এই সময়ের মধ্যে কোনো ট্রানজেকশন পাওয়া যায়নি
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {rows.map((t: any) => {
                            const debit = Number(t.debit || 0);
                            const credit = Number(t.credit || 0);
                            // Extract note from description if it contains extra details
                            const mainDesc = t.description || "";
                            const refNo = t.reference || "";

                            return (
                              <TableRow key={t.id} className="border-b hover:bg-muted/30 print:hover:bg-transparent">
                                <TableCell className="text-center text-sm font-mono">{t.sn}</TableCell>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {safeFormat(t.date, "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell className="text-sm">{getVoucherType(t.type)}</TableCell>
                                <TableCell className="text-sm font-mono text-xs">{refNo || "—"}</TableCell>
                                <TableCell className="text-sm font-medium">{mainDesc}</TableCell>
                                <TableCell className="text-sm text-muted-foreground text-xs">
                                  {t.journal_ref || ""}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {debit > 0 ? fmt(debit) : ""}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {credit > 0 ? fmt(credit) : ""}
                                </TableCell>
                                <TableCell className={`text-right font-mono text-sm font-semibold ${t.running_balance < 0 ? "text-destructive" : ""}`}>
                                  {fmt(t.running_balance)}
                                </TableCell>
                              </TableRow>
                            );
                          })}

                          {/* Totals Row */}
                          <TableRow className="font-bold bg-orange-50 dark:bg-orange-950/30 border-t-2 border-orange-300 print:bg-orange-50">
                            <TableCell colSpan={6} className="text-right font-bold text-orange-700 dark:text-orange-400">
                              Total
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {fmt(totalDebit)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {fmt(totalCredit)}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold ${closingBalance < 0 ? "text-destructive" : ""}`}>
                              {fmt(closingBalance)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {selectedAccountId && rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Total Entries</p>
                <p className="text-lg font-bold">{rows.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Total Debit</p>
                <p className="text-lg font-bold text-blue-600">৳{fmt(totalDebit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Total Credit</p>
                <p className="text-lg font-bold text-green-600">৳{fmt(totalCredit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Closing Balance</p>
                <p className={`text-lg font-bold ${closingBalance < 0 ? "text-destructive" : ""}`}>
                  ৳{fmt(closingBalance)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
