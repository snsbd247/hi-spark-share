import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
import { IS_LOVABLE } from "@/lib/environment";
import api from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Search, Loader2, Filter } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const actionColors: Record<string, string> = {
  create: "default",
  edit: "secondary",
  delete: "destructive",
  login: "default",
  logout: "outline",
  payment: "default",
  settings: "secondary",
  impersonate: "outline",
};

export default function ActivityLogs() {
  const tenantId = useTenantId();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activity-logs", tenantId],
    queryFn: async () => {
      if (IS_LOVABLE) {
        const { data, error } = await db
          .from("activity_logs" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return data || [];
      }
      const { data } = await api.get("/activity-logs");
      return data || [];
    },
  });

  const modules = [...new Set((logs as any[]).map((l: any) => l.module).filter(Boolean))];

  const filtered = (logs as any[]).filter((log: any) => {
    if (moduleFilter !== "all" && log.module !== moduleFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.description?.toLowerCase().includes(s) ||
      log.action?.toLowerCase().includes(s) ||
      log.module?.toLowerCase().includes(s) ||
      log.ip_address?.toLowerCase().includes(s)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6" /> {t.activityLogsPage.title}
          </h1>
          <p className="text-muted-foreground text-sm">{t.activityLogsPage.subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.activityLogsPage.searchLogs} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t.activityLogsPage.allModules} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.activityLogsPage.allModules}</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.activityLogsPage.time}</TableHead>
                    <TableHead>{t.activityLogsPage.action}</TableHead>
                    <TableHead>{t.activityLogsPage.module}</TableHead>
                    <TableHead>{t.common.description}</TableHead>
                    <TableHead>{t.auditLogsPage.ipAddress}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t.activityLogsPage.noLogsFound}</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={(actionColors[log.action] as any) || "secondary"} className="text-xs capitalize">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{log.module}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{log.description}</TableCell>
                        <TableCell className="text-xs font-mono">{log.ip_address || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}