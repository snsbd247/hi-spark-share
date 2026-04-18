/**
 * Non-invasive live ONU health badge — embeds in any fiber page.
 * Polls /api/fiber/onu-live-status every 30s and shows aggregate counts.
 * Gracefully hides if endpoint is unavailable (no error toast).
 */
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { oltApi, type OnuLiveStatus } from "@/lib/oltApi";
import { cn } from "@/lib/utils";

export function LiveOnuHealthBadge({ className }: { className?: string }) {
  const [data, setData] = useState<OnuLiveStatus[] | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await oltApi.liveStatus();
        if (!cancelled) setData(rows || []);
      } catch {
        if (!cancelled) setHidden(true);
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (hidden || !data) return null;

  const online = data.filter((o) => o.status === "online").length;
  const offline = data.filter((o) => o.status === "offline").length;
  const los = data.filter((o) => o.status === "los" || o.status === "dying-gasp").length;
  const total = data.length;
  if (total === 0) return null;

  const healthPct = Math.round((online / total) * 100);

  return (
    <Card className={cn("border-border/50 bg-card", className)}>
      <CardContent className="p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Live ONU Health</span>
        </div>
        <Badge variant="outline" className="gap-1">
          <Wifi className="h-3 w-3 text-primary" /> {online} online
        </Badge>
        <Badge variant="outline" className="gap-1">
          <WifiOff className="h-3 w-3 text-muted-foreground" /> {offline} offline
        </Badge>
        {los > 0 && (
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" /> {los} LOS
          </Badge>
        )}
        <Badge
          variant="outline"
          className={cn(
            "ml-auto",
            healthPct >= 90 && "border-primary/50 text-primary",
            healthPct < 90 && healthPct >= 70 && "border-accent/50 text-accent-foreground",
            healthPct < 70 && "border-destructive/50 text-destructive",
          )}
        >
          {healthPct}% healthy
        </Badge>
      </CardContent>
    </Card>
  );
}
