import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList } from "lucide-react";
import { format } from "date-fns";

export default function SuperAdminAuditLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["sa-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Audit Logs</h1>
          <p className="text-muted-foreground text-sm">All administrative actions across tenants</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {!logs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No audit logs found</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {log.admin_name || "Unknown"} — <span className="text-muted-foreground">{log.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.table_name} / {log.record_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge variant="outline" className="text-xs">{log.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
