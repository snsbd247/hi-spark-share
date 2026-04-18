/**
 * Phase 14 — OLT Performance Dashboard.
 * Overview grid of OLT health cards + detail drawer with per-PON metrics,
 * signal distribution, and 24-hour activity timeline.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Server, Wifi, WifiOff, AlertTriangle, RefreshCw, TrendingUp,
  CheckCircle2, Radio, Gauge, Network, Eye, Zap,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { oltPerformanceApi, type OltOverviewCard } from "@/lib/oltPerformanceApi";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

const SIGNAL_COLORS = {
  excellent: "hsl(var(--success))",
  good: "hsl(142 70% 45%)",
  fair: "hsl(var(--warning))",
  poor: "hsl(var(--destructive))",
  no_data: "hsl(var(--muted-foreground))",
};

function healthTone(score: number | null) {
  if (score === null) return { label: "No Data", tone: "text-muted-foreground", bg: "bg-muted/30" };
  if (score >= 90) return { label: "Excellent", tone: "text-success", bg: "bg-success/10" };
  if (score >= 75) return { label: "Healthy", tone: "text-success", bg: "bg-success/10" };
  if (score >= 50) return { label: "Degraded", tone: "text-warning", bg: "bg-warning/10" };
  return { label: "Critical", tone: "text-destructive", bg: "bg-destructive/10" };
}

export default function OltPerformancePage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["olt-performance-overview"],
    queryFn: oltPerformanceApi.overview,
    refetchInterval: 60_000,
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" /> OLT Performance Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time health, capacity & signal analytics across all OLT devices
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-1.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Totals row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon={Server} label="OLT Devices" value={data.totals.devices} tone="text-primary" />
          <KpiTile icon={Wifi} label="Total ONUs" value={data.totals.total_onus} tone="text-foreground" />
          <KpiTile icon={CheckCircle2} label="Online" value={data.totals.online_onus} tone="text-success" />
          <KpiTile icon={AlertTriangle} label="Alerts 24h" value={data.totals.alerts_24h} tone="text-warning" />
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : (data?.devices?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Server className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No OLT devices configured yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data!.devices.map((d) => (
            <OltCard key={d.id} d={d} onOpen={() => setSelected(d.id)} />
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" /> OLT Detail
            </SheetTitle>
          </SheetHeader>
          {selected && <OltDetail id={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className={cn("text-2xl font-bold mt-1", tone)}>{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function OltCard({ d, onOpen }: { d: OltOverviewCard; onOpen: () => void }) {
  const h = healthTone(d.health_score);
  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={onOpen}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2 truncate">
              <Server className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{d.name}</span>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {d.vendor.toUpperCase()} · {d.ip_address}
            </p>
          </div>
          <Badge variant="outline" className={cn("text-[10px] capitalize", h.bg, h.tone, "border-current/30")}>
            {h.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Health bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Health Score</span>
            <span className={cn("font-semibold", h.tone)}>
              {d.health_score !== null ? `${d.health_score}%` : "—"}
            </span>
          </div>
          <Progress value={d.health_score ?? 0} className="h-1.5" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="ONUs" value={d.total_onus} icon={Wifi} />
          <MiniStat label="Online" value={d.online_onus} icon={CheckCircle2} tone="text-success" />
          <MiniStat label="Offline" value={d.offline_onus + d.los_onus} icon={WifiOff} tone="text-destructive" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Avg Rx:</span>
            <span className="font-medium">{d.avg_rx_power !== null ? `${d.avg_rx_power} dBm` : "—"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-warning" />
            <span className="text-muted-foreground">Alerts:</span>
            <span className="font-medium">{d.alerts_24h}</span>
          </div>
        </div>

        <Button size="sm" variant="ghost" className="w-full mt-1 group-hover:bg-primary/10">
          <Eye className="h-3.5 w-3.5 mr-1.5" /> View Details
        </Button>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon, tone = "text-foreground" }: { label: string; value: number; icon: any; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <Icon className={cn("h-3.5 w-3.5 mx-auto mb-1", tone)} />
      <div className={cn("text-sm font-bold", tone)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function OltDetail({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["olt-performance-detail", id],
    queryFn: () => oltPerformanceApi.detail(id),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) return <div className="p-6 space-y-3"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>;

  const distData = Object.entries(data.signal_distribution).map(([k, v]) => ({
    name: k.replace("_", " "),
    value: v,
    color: SIGNAL_COLORS[k as keyof typeof SIGNAL_COLORS],
  })).filter((d) => d.value > 0);

  const timeline = data.timeline_24h.map((t) => ({
    t: format(new Date(t.hour), "HH:mm"),
    online: t.online,
    los: t.los,
    offline: t.offline,
  }));

  return (
    <div className="space-y-5 mt-4">
      <div className="text-xs text-muted-foreground">
        {data.device.vendor.toUpperCase()} · {data.device.ip_address}
        {data.device.last_polled_at && ` · last poll ${formatDistanceToNow(new Date(data.device.last_polled_at), { addSuffix: true })}`}
      </div>

      {/* PON ports table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" /> PON Port Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.ports.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-6 text-center">No ONU data for this OLT yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Port</TableHead>
                  <TableHead className="text-center">ONUs</TableHead>
                  <TableHead className="text-center text-success">Online</TableHead>
                  <TableHead className="text-center text-destructive">LOS</TableHead>
                  <TableHead className="text-center text-muted-foreground">Offline</TableHead>
                  <TableHead className="text-right">Avg Rx</TableHead>
                  <TableHead className="text-right">Util</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ports.map((p) => (
                  <TableRow key={p.port}>
                    <TableCell className="font-medium">{p.port}</TableCell>
                    <TableCell className="text-center">{p.total}</TableCell>
                    <TableCell className="text-center text-success">{p.online}</TableCell>
                    <TableCell className="text-center text-destructive">{p.los}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{p.offline}</TableCell>
                    <TableCell className="text-right">
                      {p.avg_rx !== null ? (
                        <span className={cn(p.avg_rx < -27 ? "text-destructive" : p.avg_rx < -25 ? "text-warning" : "text-success")}>
                          {p.avg_rx} dBm
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Progress value={p.utilization_pct} className="h-1.5 w-16" />
                        <span className="text-xs">{p.utilization_pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Signal distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Signal Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {distData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No signal data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e: any) => e.value}>
                      {distData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 24h timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> 24-Hour Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {timeline.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No history yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="onlineG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} minTickGap={28} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="online" stroke="hsl(var(--success))" fill="url(#onlineG)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent_alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">No alerts in recent history 🎉</p>
          ) : (
            <ul className="space-y-1.5">
              {data.recent_alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm border border-border/40 rounded-lg px-3 py-1.5">
                  <Badge variant="outline" className="text-[10px]">{a.event_type}</Badge>
                  <span className="font-mono text-xs truncate flex-1">{a.serial}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.previous_status ?? "—"} → <span className="text-foreground font-medium">{a.current_status ?? "—"}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(a.sent_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
