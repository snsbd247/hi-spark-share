import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen } from "lucide-react";

export default function BalanceSheetReport() {
  const { data: accounts = [] } = useQuery({
    queryKey: ["balance-sheet-accounts"],
    queryFn: async () => { const { data } = await (db as any).from("accounts").select("*").eq("is_active", true).order("code"); return data || []; },
  });

  const assets = accounts.filter((a: any) => a.type === "asset");
  const liabilities = accounts.filter((a: any) => a.type === "liability");
  const equity = accounts.filter((a: any) => a.type === "equity");

  const totalAssets = assets.reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
  const totalLiabilities = liabilities.reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
  const totalEquity = equity.reduce((s: number, a: any) => s + Number(a.balance || 0), 0);

  const Section = ({ title, items, total, color }: { title: string; items: any[]; total: number; color: string }) => (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            {items.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell className="text-right font-medium">৳{Number(a.balance || 0).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold border-t-2">
              <TableCell colSpan={2}>Total {title}</TableCell>
              <TableCell className={`text-right ${color}`}>৳{total.toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-6 w-6" /> Balance Sheet</h1>
          <p className="text-muted-foreground text-sm">Assets, liabilities, and equity overview</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Total Assets</p><p className="text-2xl font-bold text-primary">৳{totalAssets.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Total Liabilities</p><p className="text-2xl font-bold text-destructive">৳{totalLiabilities.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm text-muted-foreground">Total Equity</p><p className="text-2xl font-bold">৳{totalEquity.toLocaleString()}</p></CardContent></Card>
        </div>

        <Section title="Assets" items={assets} total={totalAssets} color="text-primary" />
        <Section title="Liabilities" items={liabilities} total={totalLiabilities} color="text-destructive" />
        <Section title="Equity" items={equity} total={totalEquity} color="text-foreground" />
      </div>
    </DashboardLayout>
  );
}
