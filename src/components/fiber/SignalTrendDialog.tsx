import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { signalHistoryApi, type SignalHistoryResponse } from "@/lib/signalHistoryApi";
import { format } from "date-fns";
import { TrendingDown, TrendingUp, Activity } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serial: string | null;
}

type Range = "24h" | "7d" | "30d";

export default function SignalTrendDialog({ open, onOpenChange, serial }: Props) {
  const [range, setRange] = useState<Range>("24h");
  const [data, setData] = useState<SignalHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !serial) return;
    let cancelled = false;
    setLoading(true);
    signalHistoryApi
      .get(serial, range)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to load history"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, serial, range]);

  const chartData = (data?.points ?? []).map((p) => ({
    t: format(new Date(p.recorded_at), range === "24h" ? "HH:mm" : "MMM d HH:mm"),
    rx: p.rx_power,
    tx: p.tx_power,
    oltRx: p.olt_rx_power,
  }));

  const deg = data?.degradation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Signal Trend — <span className="font-mono text-sm">{serial}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1">
            {(["24h", "7d", "30d"] as Range[]).map((r) => (
              <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
                {r}
              </Button>
            ))}
          </div>
          {deg && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5",
                deg.degraded
                  ? "bg-destructive/15 text-destructive border-destructive/30"
                  : "bg-success/15 text-success border-success/30",
              )}
            >
              {deg.degraded ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {deg.degraded ? "Degrading" : "Stable"} · Δ {deg.delta_db} dB
              <span className="opacity-70 text-[10px]">({deg.first_avg} → {deg.last_avg})</span>
            </Badge>
          )}
        </div>

        <div className="h-[360px] w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              No history yet — data is recorded as the OLT is polled.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} minTickGap={24} />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  label={{ value: "dBm", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="rx" name="ONU RX" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="tx" name="ONU TX" stroke="hsl(var(--success))" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="oltRx" name="OLT RX" stroke="hsl(var(--warning))" dot={false} strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {data ? `${data.count} points · range ${data.range}` : ""}
        </div>
      </DialogContent>
    </Dialog>
  );
}
