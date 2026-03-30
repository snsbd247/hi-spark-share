import { useState, useEffect, useSyncExternalStore } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiHealth, type ApiHealthEntry } from "@/lib/apiHealth";

import { Activity, Server, Cloud, AlertTriangle, CheckCircle, XCircle, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

let cachedStats = apiHealth.getStats();
let cachedLog = apiHealth.getLog();
const sub = (cb: () => void) => apiHealth.subscribe(() => {
  cachedStats = apiHealth.getStats();
  cachedLog = apiHealth.getLog();
  cb();
});

function useHealthData() {
  return useSyncExternalStore(sub, () => cachedStats);
}

function useHealthLog() {
  return useSyncExternalStore(sub, () => cachedLog);
}

export default function ApiHealthMonitor() {
  const { t } = useLanguage();
  const stats = useHealthData();
  const log = useHealthLog();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);

  const timeAgo = (ts: number) => {
    const diff = Math.round((now - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const laravelStatus = stats.laravelFail === 0 && stats.laravelOk > 0
    ? "healthy" : stats.laravelOk === 0 && stats.laravelFail > 0
    ? "down" : stats.laravelFail > 0
    ? "degraded" : "unknown";

  const edgeStatus = stats.edgeFail === 0 && stats.edgeOk > 0
    ? "healthy" : stats.edgeOk === 0 && stats.edgeFail > 0
    ? "down" : stats.edgeFail > 0
    ? "degraded" : "unknown";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              API Health Monitor
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Real-time API status, response times & circuit breaker state
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => apiHealth.clear()}>
            <Trash2 className="h-4 w-4 mr-1" /> Clear Log
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusCard
            title="Laravel API"
            icon={Server}
            status={laravelStatus}
            successCount={stats.laravelOk}
            failCount={stats.laravelFail}
            avgMs={stats.laravelAvgMs}
          />
          <StatusCard
            title="Edge Functions"
            icon={Cloud}
            status={edgeStatus}
            successCount={stats.edgeOk}
            failCount={stats.edgeFail}
            avgMs={stats.edgeAvgMs}
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Circuit Breaker
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={stats.circuit.isOpen ? "destructive" : "default"} className={!stats.circuit.isOpen ? "bg-green-600" : ""}>
                  {stats.circuit.isOpen ? "OPEN (blocking)" : "CLOSED (normal)"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Failures: {stats.circuit.failures} / 3
              </p>
              <p className="text-xs text-muted-foreground">
                Mode: Laravel Direct
              </p>
              {stats.circuit.isOpen && (
                <p className="text-xs text-orange-500 mt-1">
                  Auto-reset in {Math.max(0, Math.ceil((30000 - (now - stats.circuit.openedAt)) / 1000))}s
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Last Error */}
        {stats.lastError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Last Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono break-all">{stats.lastError.error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.lastError.endpoint} • {stats.lastError.source} • {timeAgo(stats.lastError.timestamp)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Request Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Requests (last 5 min)</CardTitle>
          </CardHeader>
          <CardContent>
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No API requests recorded yet. Navigate around the app to generate data.
              </p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {log.slice(0, 50).map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/50">
                    {entry.status === "success" ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                      {entry.source}
                    </Badge>
                    <span className="font-mono truncate flex-1">{entry.endpoint}</span>
                    <span className="text-muted-foreground shrink-0">{entry.responseTime}ms</span>
                    <span className="text-muted-foreground shrink-0">{timeAgo(entry.timestamp)}</span>
                    {entry.error && (
                      <span className="text-destructive truncate max-w-[200px]" title={entry.error}>{entry.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StatusCard({ title, icon: Icon, status, successCount, failCount, avgMs }: {
  title: string;
  icon: React.ElementType;
  status: string;
  successCount: number;
  failCount: number;
  avgMs: number;
}) {
  const colors: Record<string, string> = {
    healthy: "text-green-500",
    degraded: "text-yellow-500",
    down: "text-destructive",
    unknown: "text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", {
            "bg-green-500": status === "healthy",
            "bg-yellow-500": status === "degraded",
            "bg-destructive": status === "down",
            "bg-muted-foreground": status === "unknown",
          })} />
          <span className={cn("text-sm font-medium capitalize", colors[status])}>{status}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div>✓ {successCount}</div>
          <div>✗ {failCount}</div>
          <div>~{avgMs}ms</div>
        </div>
      </CardContent>
    </Card>
  );
}
