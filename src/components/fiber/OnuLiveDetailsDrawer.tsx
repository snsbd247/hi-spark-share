/**
 * Phase 12 — ONU live details side-drawer.
 * Triggered by clicking the status dot in tree/map. Shows:
 *  - Live status header (status, rx/tx, uptime, last-seen)
 *  - 24h signal sparkline (lazy-loaded from history API)
 *  - Recent alert events (last 10)
 *  - Recent MikroTik auto-sync actions (last 10)
 *  - Quick links: open trend dialog, view alert/sync logs pages
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Activity, ExternalLink, AlertTriangle, Wrench, Radio, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { signalHistoryApi, type SignalHistoryResponse } from "@/lib/signalHistoryApi";
import { onuAlertApi, type OnuAlertLog } from "@/lib/onuAlertApi";
import { onuMikrotikSyncApi, type OnuMikrotikSyncLog } from "@/lib/onuMikrotikSyncApi";
import { statusVisual, type LiveOnuMeta } from "@/hooks/useLiveOnuStatusMap";
import { safeFormat, cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serial: string | null;
  meta?: LiveOnuMeta | null;
  customerName?: string | null;
  customerId?: string | null;
}

export default function OnuLiveDetailsDrawer({ open, onOpenChange, serial, meta, customerName, customerId }: Props) {
  const [history, setHistory] = useState<SignalHistoryResponse | null>(null);
  const [alerts, setAlerts] = useState<OnuAlertLog[]>([]);
  const [syncs, setSyncs] = useState<OnuMikrotikSyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const v = statusVisual(meta?.status);

  useEffect(() => {
    if (!open || !serial) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      signalHistoryApi.get(serial, "24h"),
      onuAlertApi.logs({ serial }),
      onuMikrotikSyncApi.listLogs({ serial }),
    ]).then(([h, a, s]) => {
      if (cancelled) return;
      if (h.status === "fulfilled") setHistory(h.value);
      if (a.status === "fulfilled") setAlerts((a.value || []).slice(0, 10));
      if (s.status === "fulfilled") setSyncs((s.value || []).slice(0, 10));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, serial]);

  const chartData = (history?.points ?? []).map((p) => ({
    t: format(new Date(p.recorded_at), "HH:mm"),
    rx: p.rx_power,
  }));
  const deg = history?.degradation;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <span className="font-mono text-sm">{serial}</span>
            <Badge className={cn("ml-auto", v.bg, v.border, "border")}>
              <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1.5", v.dot)} />
              {v.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Live snapshot */}
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          <Stat label="Rx Power" value={meta?.rx_power !== null && meta?.rx_power !== undefined ? `${meta.rx_power.toFixed(2)} dBm` : "—"} />
          <Stat label="Tx Power" value={meta?.tx_power !== null && meta?.tx_power !== undefined ? `${meta.tx_power.toFixed(2)} dBm` : "—"} />
          <Stat label="OLT Rx" value={meta?.olt_rx_power !== null && meta?.olt_rx_power !== undefined ? `${meta.olt_rx_power.toFixed(2)} dBm` : "—"} />
          <Stat label="Uptime" value={meta?.uptime || "—"} />
          <Stat label="Last seen" value={meta?.last_seen ? safeFormat(meta.last_seen, "MMM d, HH:mm:ss") : "—"} />
          {customerName && <Stat label="Customer" value={customerName} />}
        </div>

        {customerId && (
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <Link to={`/customers/${customerId}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View customer
            </Link>
          </Button>
        )}

        <Separator className="my-4" />

        {/* Sparkline */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> 24h Rx Trend
            </h3>
            {deg?.degraded && (
              <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                <TrendingDown className="h-3 w-3 mr-1" /> Degrading · Δ {deg.delta_db} dB
              </Badge>
            )}
          </div>
          <div className="h-[140px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No history yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                  <XAxis dataKey="t" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} minTickGap={32} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  />
                  <Line type="monotone" dataKey="rx" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Recent alerts */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Recent Alerts
            </h3>
            <Button asChild variant="ghost" size="sm" className="h-6 text-[10px]">
              <Link to="/fiber/alert-logs">All →</Link>
            </Button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No alerts in history</p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((a) => (
                <li key={a.id} className="text-xs flex items-center gap-2 border border-border/50 rounded-md px-2 py-1.5">
                  <Badge variant="outline" className="text-[10px]">{a.event_type}</Badge>
                  <span className="text-muted-foreground flex-1 truncate">
                    {a.previous_status ?? "—"} → {a.current_status ?? "—"}
                  </span>
                  <span className="text-muted-foreground text-[10px]">{safeFormat(a.sent_at, "MMM d HH:mm")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator className="my-4" />

        {/* Recent auto-sync actions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> MikroTik Auto-Sync
            </h3>
            <Button asChild variant="ghost" size="sm" className="h-6 text-[10px]">
              <Link to="/fiber/mikrotik-sync-logs">All →</Link>
            </Button>
          </div>
          {syncs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No auto-sync actions</p>
          ) : (
            <ul className="space-y-1">
              {syncs.map((s) => (
                <li key={s.id} className="text-xs flex items-center gap-2 border border-border/50 rounded-md px-2 py-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      s.action === "disable"
                        ? "bg-destructive/15 text-destructive border-destructive/30"
                        : "bg-success/15 text-success border-success/30",
                    )}
                  >
                    {s.action}
                  </Badge>
                  <span className="text-muted-foreground flex-1 truncate">
                    {s.trigger_event} · {s.success ? "OK" : "fail"}
                  </span>
                  <span className="text-muted-foreground text-[10px]">{safeFormat(s.executed_at, "MMM d HH:mm")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/40 rounded-md px-2 py-1.5 bg-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
