import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Database, Activity, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect } from "react";
import { toast } from "sonner";

export default function NotificationCenter() {
  const queryClient = useQueryClient();

  const { data: backupLogs } = useQuery({
    queryKey: ["notification-backup-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  // Real-time subscription for backup_logs
  useEffect(() => {
    const channel = supabase
      .channel("backup-logs-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "backup_logs" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["notification-backup-logs"] });
          const log = payload.new as any;
          if (log.status === "completed") {
            toast.success(`Backup completed: ${log.file_name}`);
          } else if (log.status === "failed") {
            toast.error(`Backup failed: ${log.error_message || log.file_name}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />;
    if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    return <Activity className="h-3.5 w-3.5 text-warning animate-pulse shrink-0" />;
  };

  return (
    <Card className="glass-card animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notification Center
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recent Backup Events */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Database className="h-4 w-4 text-primary" />
            Recent Backup Events
          </div>
          <ScrollArea className="h-[200px]">
            {!backupLogs || backupLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No backup events yet</p>
            ) : (
              <div className="space-y-2 pr-3">
                {backupLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 rounded bg-muted/30 p-2">
                    {statusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-foreground truncate">{log.file_name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {log.backup_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                        {log.file_size > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {(log.file_size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                      {log.error_message && (
                        <p className="text-[10px] text-destructive mt-0.5 truncate">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
