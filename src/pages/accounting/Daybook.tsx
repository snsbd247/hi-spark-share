import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

export default function Daybook() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["daybook", date],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("transactions")
        .select("*, account:accounts(id, name, code, type)")
        .gte("date", date)
        .lte("date", date + "T23:59:59")
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const totalDebit = transactions.reduce((s: number, t: any) => s + Number(t.debit || 0), 0);
  const totalCredit = transactions.reduce((s: number, t: any) => s + Number(t.credit || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Daybook</h1>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Date:</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Entries</p><p className="text-lg font-bold">{transactions.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Debit</p><p className="text-lg font-bold text-blue-600">{fmt(totalDebit)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total Credit</p><p className="text-lg font-bold text-green-600">{fmt(totalCredit)}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Transactions on {safeFormat(date, "dd MMMM yyyy")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <p className="text-center py-8 text-muted-foreground">{t.common.loading}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-center">Ledger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t: any, i: number) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        {t.account ? (
                          <span className="text-sm"><code className="bg-muted px-1 rounded text-xs mr-1">{t.account.code}</code>{t.account.name}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell>{t.reference ? <Badge variant="outline" className="text-xs">{t.reference}</Badge> : "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{t.type}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{Number(t.debit) > 0 ? fmt(Number(t.debit)) : "—"}</TableCell>
                      <TableCell className="text-right font-mono">{Number(t.credit) > 0 ? fmt(Number(t.credit)) : "—"}</TableCell>
                      <TableCell className="text-center">
                        {t.account_id && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/accounting/ledger-statement?account_id=${t.account_id}&name=${encodeURIComponent(t.account?.name || "")}&code=${t.account?.code || ""}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No transactions on this date</TableCell></TableRow>
                  )}
                  {transactions.length > 0 && (
                    <TableRow className="font-bold bg-muted/30 border-t-2">
                      <TableCell colSpan={5} className="text-right">Total</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">{fmt(totalDebit)}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{fmt(totalCredit)}</TableCell>
                      <TableCell />
                    </TableRow>
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
