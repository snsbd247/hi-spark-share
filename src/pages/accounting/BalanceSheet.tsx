import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scale } from "lucide-react";

export default function BalanceSheet() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["balance-sheet", asOf],
    queryFn: () => api.get(`/accounting/balance-sheet?as_of=${asOf}`).then(r => r.data),
  });

  const formatAmount = (v: number) => `৳${Number(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Scale className="h-6 w-6" /> Balance Sheet</h1>
            <p className="text-muted-foreground text-sm">Assets = Liabilities + Equity</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">As of:</Label>
            <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-40" />
          </div>
        </div>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets */}
            <Card>
              <CardHeader><CardTitle className="text-green-600">Assets</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {data.assets?.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(a.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/30">
                      <TableCell>Total Assets</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(data.total_assets)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Liabilities + Equity */}
            <Card>
              <CardHeader><CardTitle className="text-red-600">Liabilities & Equity</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {data.liabilities?.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(a.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total Liabilities</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(data.total_liabilities)}</TableCell>
                    </TableRow>
                    {data.equity?.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(a.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="italic">Retained Earnings</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(data.retained_earnings)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold bg-muted/30">
                      <TableCell>Total Liabilities & Equity</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(data.total_liabilities_equity)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Balance Check */}
            <Card className="lg:col-span-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Balance Check</p>
                    <p className="text-lg font-bold">
                      Assets ({formatAmount(data.total_assets)}) = Liabilities + Equity ({formatAmount(data.total_liabilities_equity)})
                    </p>
                  </div>
                  <Badge variant={Math.abs(data.total_assets - data.total_liabilities_equity) < 0.01 ? "default" : "destructive"}>
                    {Math.abs(data.total_assets - data.total_liabilities_equity) < 0.01 ? "✓ Balanced" : "✗ Unbalanced"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
