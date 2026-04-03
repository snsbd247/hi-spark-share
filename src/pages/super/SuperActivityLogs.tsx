import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Search, Activity, FileText, Loader2, Eye, Shield, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SuperActivityLogs() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const [tab, setTab] = useState("audit");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [detailLog, setDetailLog] = useState<any>(null);

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ["super-audit-logs"],
    queryFn: async () => {
      const { data } = await db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const { data: activityLogs = [], isLoading: activityLoading } = useQuery({
    queryKey: ["super-activity-logs"],
    queryFn: async () => {
      const { data } = await db.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const filterLogs = (logs: any[]) =>
    logs.filter((l) => {
      const matchSearch = [l.admin_name, l.table_name, l.action, l.module, l.description, l.record_id]
        .some((v) => v && v.toLowerCase().includes(search.toLowerCase()));
      const matchAction = actionFilter === "all" || l.action === actionFilter;
      return matchSearch && matchAction;
    });

  const actionColor = (action: string) => {
    switch (action) {
      case "create": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "edit": case "update": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "delete": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filteredAudit = filterLogs(auditLogs);
  const filteredActivity = filterLogs(activityLogs);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> {sa.activityAuditLogs}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Track all system actions and data changes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: sa.auditEntries, value: auditLogs.length, icon: FileText },
          { label: sa.activityEntries, value: activityLogs.length, icon: Activity },
          { label: sa.creates, value: auditLogs.filter((l: any) => l.action === "create").length, icon: Shield },
          { label: sa.deletes, value: auditLogs.filter((l: any) => l.action === "delete").length, icon: Clock },
        ].map((s, i) => (
          <Card key={i} className="glass-card border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={sa.searchLogs} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{sa.allActions}</SelectItem>
            <SelectItem value="create">{sa.create}</SelectItem>
            <SelectItem value="edit">{sa.edit}</SelectItem>
            <SelectItem value="delete">{sa.delete}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="audit" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> {sa.auditLogs}</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> {sa.activityLogs}</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <Card className="glass-card border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>{sa.time}</TableHead>
                    <TableHead>{sa.user}</TableHead>
                    <TableHead>{sa.action}</TableHead>
                    <TableHead>{sa.table}</TableHead>
                    <TableHead>{sa.recordId}</TableHead>
                    <TableHead className="text-right">{sa.details}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredAudit.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{sa.noLogsFound}</TableCell></TableRow>
                  ) : filteredAudit.slice(0, 100).map((l: any) => (
                    <TableRow key={l.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(l.created_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{l.admin_name || "System"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs capitalize ${actionColor(l.action)}`}>{l.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">{l.table_name}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">{l.record_id}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailLog(l)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="glass-card border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>{sa.time}</TableHead>
                    <TableHead>{sa.module}</TableHead>
                    <TableHead>{sa.action}</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>{sa.ip}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredActivity.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{sa.noLogsFound}</TableCell></TableRow>
                  ) : filteredActivity.slice(0, 100).map((l: any) => (
                    <TableRow key={l.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(l.created_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{l.module}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs capitalize ${actionColor(l.action)}`}>{l.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{l.description}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{l.ip_address || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> {sa.auditLogDetail}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">User:</span> <span className="font-medium ml-1">{detailLog.admin_name}</span></div>
                  <div><span className="text-muted-foreground">Action:</span> <Badge variant="outline" className={`ml-1 text-xs ${actionColor(detailLog.action)}`}>{detailLog.action}</Badge></div>
                  <div><span className="text-muted-foreground">Table:</span> <span className="font-mono ml-1">{detailLog.table_name}</span></div>
                  <div><span className="text-muted-foreground">Record:</span> <span className="font-mono text-xs ml-1">{detailLog.record_id}</span></div>
                  <div><span className="text-muted-foreground">Time:</span> <span className="ml-1">{format(new Date(detailLog.created_at), "PPpp")}</span></div>
                  <div><span className="text-muted-foreground">IP:</span> <span className="font-mono ml-1">{detailLog.ip_address || "—"}</span></div>
                </div>

                {detailLog.old_data && (
                  <div>
                    <p className="text-sm font-semibold text-red-500 mb-1">{sa.before}</p>
                    <pre className="bg-muted/50 p-3 rounded-lg text-xs overflow-auto max-h-48 font-mono">
                      {JSON.stringify(detailLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
                {detailLog.new_data && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-500 mb-1">{sa.after}</p>
                    <pre className="bg-muted/50 p-3 rounded-lg text-xs overflow-auto max-h-48 font-mono">
                      {JSON.stringify(detailLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
