import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function InventoryLogs() {
  const { t } = useLanguage();
  const tenantId = useTenantId();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["inventory_logs_all", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant((db as any).from("inventory_logs")
        .select("*,product:products(name)")
        .order("created_at", { ascending: false })
        .limit(200), tenantId);
      return data || [];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.inventory.inventoryLogs}</h1>
          <p className="text-muted-foreground text-sm">{t.inventory.auditTrailDesc}</p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.date}</TableHead>
                  <TableHead>{t.inventory.product}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.common.amount}</TableHead>
                  <TableHead>{t.common.note}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t.inventory.noLogsFound}</TableCell></TableRow>
                ) : logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{log.product?.name || t.inventory.unknown}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {log.type === "in" && <ArrowDown className="h-4 w-4 text-green-600" />}
                        {log.type === "out" && <ArrowUp className="h-4 w-4 text-red-600" />}
                        {log.type === "return" && <RotateCcw className="h-4 w-4 text-blue-600" />}
                        <Badge variant={log.type === "in" ? "default" : log.type === "out" ? "destructive" : "secondary"}>
                          {log.type === "in" ? t.inventory.stockIn : log.type === "out" ? t.inventory.stockOut : t.inventory.returned}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {log.type === "in" || log.type === "return" ? "+" : "-"}{log.quantity}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{log.note || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
