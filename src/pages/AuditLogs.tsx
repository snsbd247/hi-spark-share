import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Eye } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuditLogs() {
  const { t } = useLanguage();
  const tenantId = useTenantId();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailLog, setDetailLog] = useState<any>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeByTenant(db
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500), tenantId);
      if (error) throw error;
      return data;
    },
  });

  const filtered = logs?.filter((l) => {
    const matchSearch = !search ||
      l.admin_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.table_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.record_id?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === "all" || l.action === actionFilter;
    const logDate = new Date(l.created_at);
    const matchFrom = !dateFrom || logDate >= new Date(dateFrom);
    const matchTo = !dateTo || logDate <= new Date(dateTo + "T23:59:59");
    return matchSearch && matchAction && matchFrom && matchTo;
  });

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t.auditLogsPage.title}</h1>
        <p className="text-muted-foreground mt-1">{t.auditLogsPage.subtitle}</p>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t.auditLogsPage.searchPlaceholder} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder={t.auditLogsPage.actionType} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.auditLogsPage.allActions}</SelectItem>
                <SelectItem value="edit">{t.common.edit}</SelectItem>
                <SelectItem value="delete">{t.common.delete}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.date}</TableHead>
                  <TableHead>{t.auditLogsPage.admin}</TableHead>
                  <TableHead>{t.auditLogsPage.action}</TableHead>
                  <TableHead>{t.auditLogsPage.table}</TableHead>
                  <TableHead>{t.auditLogsPage.recordId}</TableHead>
                  <TableHead className="text-right">{t.auditLogsPage.details}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">{t.auditLogsPage.noLogsFound}</TableCell></TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">{safeFormat(log.created_at, "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell className="font-medium">{log.admin_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={log.action === "delete" ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-primary/10 text-primary border-primary/20"}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.table_name}</TableCell>
                      <TableCell className="font-mono text-xs">{log.record_id.substring(0, 8)}...</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(o) => !o && setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t.auditLogsPage.auditLogDetails}</DialogTitle></DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">{t.auditLogsPage.admin}</p><p className="font-medium">{detailLog.admin_name}</p></div>
                <div><p className="text-muted-foreground">{t.auditLogsPage.action}</p><p className="font-medium capitalize">{detailLog.action}</p></div>
                <div><p className="text-muted-foreground">{t.auditLogsPage.table}</p><p className="font-mono">{detailLog.table_name}</p></div>
                <div><p className="text-muted-foreground">{t.common.date}</p><p>{safeFormat(detailLog.created_at, "dd MMM yyyy HH:mm:ss")}</p></div>
              </div>
              <div><p className="text-muted-foreground mb-1">{t.auditLogsPage.recordId}</p><p className="font-mono text-xs bg-muted rounded p-2 break-all">{detailLog.record_id}</p></div>
              {detailLog.old_data && (
                <div><p className="text-muted-foreground mb-1">{t.auditLogsPage.oldData}</p><pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detailLog.old_data, null, 2)}</pre></div>
              )}
              {detailLog.new_data && (
                <div><p className="text-muted-foreground mb-1">{t.auditLogsPage.newData}</p><pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{JSON.stringify(detailLog.new_data, null, 2)}</pre></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}