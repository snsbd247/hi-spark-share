/**
 * Phase 13 — Customer-facing ONU connection health page.
 * Polls /api/portal/connection-health every 60s, shows:
 *  - Verdict hero (healthy/degraded/critical/offline)
 *  - Live signal + uptime stats
 *  - 24h Rx trend sparkline
 *  - Recent outages
 *  - Self-service troubleshooting checklist with "Open ticket" CTA
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle2, RefreshCw, Radio, Clock, TrendingDown, LifeBuoy, Power, Cable, Phone } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { connectionHealthApi, type HealthVerdict } from "@/lib/connectionHealthApi";
import { safeFormat, cn } from "@/lib/utils";

const VERDICT_META: Record<HealthVerdict, { label: string; tone: string; bg: string; icon: any; desc: string }> = {
  healthy:  { label: "Healthy",  tone: "text-success",     bg: "bg-success/10 border-success/30",     icon: CheckCircle2,  desc: "Your connection is operating normally." },
  degraded: { label: "Degraded", tone: "text-warning",     bg: "bg-warning/10 border-warning/30",     icon: TrendingDown,  desc: "Signal strength is weaker than recommended. You may experience slowdowns." },
  critical: { label: "Critical", tone: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: AlertTriangle, desc: "Loss of signal detected. Service is interrupted." },
  offline:  { label: "Offline",  tone: "text-muted-foreground", bg: "bg-muted/30 border-border", icon: WifiOff, desc: "Device is not reachable. Please check your equipment." },
  unknown:  { label: "Unknown",  tone: "text-muted-foreground", bg: "bg-muted/20 border-border", icon: Radio, desc: "No live data available yet. Try refreshing in a moment." },
};

export default function CustomerConnectionHealth() {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["customer-connection-health"],
    queryFn: connectionHealthApi.get,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const verdict = (data?.verdict ?? "unknown") as HealthVerdict;
  const meta = VERDICT_META[verdict];
  const Icon = meta.icon;

  const chartData = useMemo(
    () =>
      (data?.trend_points ?? [])
        .filter((p) => p.rx_power !== null)
        .map((p) => ({
          t: format(new Date(p.recorded_at), "HH:mm"),
          rx: p.rx_power,
        })),
    [data?.trend_points],
  );

  const handleOpenTicket = () => {
    const subject = `Connection issue — ${data?.serial ?? "ONU"}`;
    const description = data
      ? [
          `Verdict: ${meta.label}`,
          data.live?.status ? `ONU status: ${data.live.status}` : null,
          data.live?.rx_power !== null && data.live?.rx_power !== undefined ? `Rx: ${data.live.rx_power.toFixed(2)} dBm` : null,
          data.live?.tx_power !== null && data.live?.tx_power !== undefined ? `Tx: ${data.live.tx_power.toFixed(2)} dBm` : null,
          data.uptime_24h_pct !== null && data.uptime_24h_pct !== undefined ? `24h uptime: ${data.uptime_24h_pct}%` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "";
    navigate(
      `/portal/tickets?new=1&subject=${encodeURIComponent(subject)}&description=${encodeURIComponent(description)}`,
    );
  };

  return (
    <PortalLayout>
      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> My Connection Health
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time status of your fiber connection
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : !data?.has_device ? (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-8 text-center space-y-3">
              <WifiOff className="h-12 w-12 mx-auto text-warning" />
              <h2 className="text-lg font-semibold">No device assigned</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {data?.message ?? "We couldn't find an optical device linked to your account. Please contact our support team."}
              </p>
              <Button onClick={handleOpenTicket}>
                <LifeBuoy className="h-4 w-4 mr-1.5" /> Contact support
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Verdict hero */}
            <Card className={cn("border-2", meta.bg)}>
              <CardContent className="p-6 flex items-start gap-4">
                <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shrink-0", meta.bg)}>
                  <Icon className={cn("h-7 w-7", meta.tone)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className={cn("text-xl font-bold", meta.tone)}>{meta.label}</h2>
                    {verdict === "healthy" && (
                      <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{meta.desc}</p>
                  {data.live?.last_seen && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Last seen: {safeFormat(data.live.last_seen, "MMM d, HH:mm:ss")}
                      {" · "}
                      {formatDistanceToNow(new Date(data.live.last_seen), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile
                icon={Radio}
                label="Signal (Rx)"
                value={data.live?.rx_power !== null && data.live?.rx_power !== undefined ? `${data.live.rx_power.toFixed(2)} dBm` : "—"}
                hint={data.live?.rx_power !== null && data.live?.rx_power !== undefined && data.live.rx_power < -27 ? "Weak" : "Good"}
                hintTone={data.live?.rx_power !== null && data.live?.rx_power !== undefined && data.live.rx_power < -27 ? "text-warning" : "text-success"}
              />
              <StatTile
                icon={Wifi}
                label="Signal (Tx)"
                value={data.live?.tx_power !== null && data.live?.tx_power !== undefined ? `${data.live.tx_power.toFixed(2)} dBm` : "—"}
              />
              <StatTile
                icon={Activity}
                label="24h Uptime"
                value={data.uptime_24h_pct !== null && data.uptime_24h_pct !== undefined ? `${data.uptime_24h_pct}%` : "—"}
                hintTone={
                  (data.uptime_24h_pct ?? 100) >= 99 ? "text-success" :
                  (data.uptime_24h_pct ?? 100) >= 90 ? "text-warning" : "text-destructive"
                }
                hint={
                  (data.uptime_24h_pct ?? 100) >= 99 ? "Excellent" :
                  (data.uptime_24h_pct ?? 100) >= 90 ? "Fair" : "Poor"
                }
              />
              <StatTile
                icon={Clock}
                label="Device uptime"
                value={data.live?.uptime || "—"}
              />
            </div>

            {/* Trend chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-primary" /> 24-hour Signal Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[180px] w-full">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Not enough data collected yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
                        <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} minTickGap={32} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={["auto", "auto"]} unit=" dBm" width={60} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: any) => [`${v} dBm`, "Rx"]}
                        />
                        <Line type="monotone" dataKey="rx" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent outages + Troubleshoot side-by-side on desktop */}
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" /> Recent Outages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(data.recent_outages?.length ?? 0) === 0 ? (
                    <div className="text-sm text-muted-foreground italic py-4 text-center">
                      No outages in recent history 🎉
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {data.recent_outages!.map((o) => (
                        <li key={o.id} className="flex items-center gap-2 text-sm border border-border/50 rounded-lg px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">{o.event_type}</Badge>
                          <span className="text-muted-foreground flex-1 truncate">
                            {o.previous_status ?? "—"} → <span className="text-foreground font-medium">{o.current_status ?? "—"}</span>
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(o.sent_at), { addSuffix: true })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LifeBuoy className="h-4 w-4 text-primary" /> Self-Service Troubleshoot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <TroubleStep icon={Power} title="Power-cycle your ONU" desc="Unplug power for 30 seconds, then plug back in. Wait 2 minutes." />
                  <TroubleStep icon={Cable} title="Check the fiber cable" desc="Make sure the optical (yellow) cable is fully seated and not bent sharply." />
                  <TroubleStep icon={Wifi} title="Restart your router" desc="If the ONU is online but Wi-Fi isn't working, restart your home router." />
                  <Button onClick={handleOpenTicket} className="w-full mt-2">
                    <Phone className="h-4 w-4 mr-1.5" /> Still having issues? Open support ticket
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}

function StatTile({ icon: Icon, label, value, hint, hintTone }: { icon: any; label: string; value: string; hint?: string; hintTone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="text-lg font-bold mt-1">{value}</div>
        {hint && <div className={cn("text-[11px] mt-0.5", hintTone || "text-muted-foreground")}>{hint}</div>}
      </CardContent>
    </Card>
  );
}

function TroubleStep({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
