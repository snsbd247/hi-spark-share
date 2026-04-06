import { useState, useEffect, useCallback, useRef } from "react";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, ArrowUp, ArrowDown, Users, Play, Pause, Wifi, Zap, Moon, Crown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import { IS_LOVABLE } from "@/lib/environment";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

const MAX_HISTORY = 30;

interface LiveUser {
  pppoe_username: string;
  customer_name: string;
  customer_id: string;
  upload_bps: number;
  download_bps: number;
  total_bps: number;
  upload_mbps: number;
  download_mbps: number;
  total_mbps: number;
  upload_formatted: string;
  download_formatted: string;
  total_formatted: string;
  uptime: string;
  ip_address: string;
  router_name: string;
  status: "normal" | "heavy" | "idle";
}

interface SpeedPoint { time: string; upload: number; download: number; }

function formatBps(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

const STATUS_BADGE: Record<string, { variant: "default" | "destructive" | "secondary"; icon: typeof Zap; label: string }> = {
  heavy: { variant: "destructive", icon: Zap, label: "Heavy" },
  idle: { variant: "secondary", icon: Moon, label: "Idle" },
  normal: { variant: "default", icon: Activity, label: "Normal" },
};

export default function ResellerLiveBandwidth() {
  const { reseller } = useResellerAuth();
  const [isPolling, setIsPolling] = useState(true);
  const [pollInterval, setPollInterval] = useState(5);
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [totalUpload, setTotalUpload] = useState(0);
  const [totalDownload, setTotalDownload] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [heavyCount, setHeavyCount] = useState(0);
  const [idleCount, setIdleCount] = useState(0);
  const [peakUser, setPeakUser] = useState<any>(null);
  const [history, setHistory] = useState<SpeedPoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLive = useCallback(async () => {
    if (!reseller?.id) return;
    try {
      let data: any;

      if (IS_LOVABLE) {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const url = `https://${projectId}.supabase.co/functions/v1/live-bandwidth?tenant_id=${reseller.tenant_id}&reseller_id=${reseller.id}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${anonKey}` } });
        if (!res.ok) return;
        data = await res.json();
      } else {
        const token = sessionStorage.getItem("reseller_session_token");
        const res = await fetch(`${API_BASE_URL}/reseller/live-bandwidth`, {
          headers: { "X-Session-Token": token || "" },
        });
        if (!res.ok) return;
        data = await res.json();
      }

      setUsers(data.users || []);
      setTotalUpload(data.total_upload || 0);
      setTotalDownload(data.total_download || 0);
      setActiveCount(data.active_count || 0);
      setHeavyCount(data.heavy_users || 0);
      setIdleCount(data.idle_users || 0);
      setPeakUser(data.peak_user || null);

      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastUpdate(timeStr);

      setHistory((prev) => {
        const next = [...prev, {
          time: timeStr,
          upload: Math.round((data.total_upload || 0) / 1_000_000 * 100) / 100,
          download: Math.round((data.total_download || 0) / 1_000_000 * 100) / 100,
        }];
        return next.slice(-MAX_HISTORY);
      });
    } catch (e) {
      console.error("Live bandwidth fetch error:", e);
    }
  }, [reseller?.id, reseller?.tenant_id]);

  useEffect(() => {
    if (!isPolling) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    fetchLive();
    timerRef.current = setInterval(fetchLive, pollInterval * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPolling, pollInterval, fetchLive]);

  const top5 = users.slice(0, 5);
  const top5Chart = top5.map((u) => ({
    name: u.customer_name.length > 12 ? u.customer_name.slice(0, 12) + "…" : u.customer_name,
    upload: u.upload_mbps,
    download: u.download_mbps,
  }));

  return (
    <ResellerLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> Live Bandwidth
            </h1>
            <p className="text-muted-foreground mt-1">Real-time speed of your customers</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(pollInterval)} onValueChange={(v) => setPollInterval(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5s</SelectItem>
                <SelectItem value="10">10s</SelectItem>
                <SelectItem value="15">15s</SelectItem>
                <SelectItem value="30">30s</SelectItem>
              </SelectContent>
            </Select>
            <Button variant={isPolling ? "destructive" : "default"} size="sm" onClick={() => setIsPolling(!isPolling)}>
              {isPolling ? <><Pause className="h-4 w-4 mr-1" /> Pause</> : <><Play className="h-4 w-4 mr-1" /> Resume</>}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={isPolling ? "default" : "secondary"} className="gap-1 text-xs">
            <Wifi className="h-3 w-3" /> {isPolling ? "LIVE" : "PAUSED"}
          </Badge>
          {lastUpdate && <span>Updated: {lastUpdate}</span>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Active</p>
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Upload</p>
            <p className="text-lg font-bold">{formatBps(totalUpload)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Download</p>
            <p className="text-lg font-bold">{formatBps(totalDownload)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3 text-destructive" /> Heavy</p>
            <p className="text-2xl font-bold text-destructive">{heavyCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Moon className="h-3 w-3" /> Idle</p>
            <p className="text-2xl font-bold text-muted-foreground">{idleCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Crown className="h-3 w-3 text-warning" /> Peak</p>
            <p className="text-sm font-bold truncate">{peakUser?.customer_name || "—"}</p>
            <p className="text-xs text-muted-foreground">{peakUser?.total_formatted || ""}</p>
          </CardContent></Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Speed Over Time (Mbps)</CardTitle></CardHeader>
            <CardContent>
              {history.length < 2 ? (
                <div className="flex items-center justify-center h-[240px] text-muted-foreground">
                  <div className="text-center"><Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" /><p>Collecting data...</p></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)} Mbps`} />
                    <Legend />
                    <Line type="monotone" dataKey="upload" stroke="hsl(150, 60%, 45%)" strokeWidth={2} dot={false} name="Upload" />
                    <Line type="monotone" dataKey="download" stroke="hsl(210, 70%, 55%)" strokeWidth={2} dot={false} name="Download" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crown className="h-4 w-4 text-warning" /> Top 5 (Mbps)</CardTitle></CardHeader>
            <CardContent>
              {top5Chart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No active users</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={top5Chart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)} Mbps`} />
                    <Bar dataKey="upload" name="Upload" fill="hsl(150, 60%, 45%)" stackId="a" />
                    <Bar dataKey="download" name="Download" fill="hsl(210, 70%, 55%)" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Active Users ({activeCount})</span>
              <div className="flex gap-2 text-xs">
                <Badge variant="destructive" className="gap-1"><Zap className="h-3 w-3" /> Heavy: {heavyCount}</Badge>
                <Badge variant="secondary" className="gap-1"><Moon className="h-3 w-3" /> Idle: {idleCount}</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>PPPoE</TableHead>
                    <TableHead className="text-right">Upload</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uptime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No active sessions</TableCell></TableRow>
                  ) : users.slice(0, 50).map((u, i) => {
                    const sb = STATUS_BADGE[u.status] || STATUS_BADGE.normal;
                    const StatusIcon = sb.icon;
                    return (
                      <TableRow key={u.pppoe_username} className={u.status === "heavy" ? "bg-destructive/5" : u.status === "idle" ? "bg-muted/30" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{u.customer_name}</TableCell>
                        <TableCell className="font-mono text-xs">{u.pppoe_username}</TableCell>
                        <TableCell className="text-right text-xs font-medium" style={{ color: "hsl(150, 60%, 45%)" }}>{u.upload_formatted}</TableCell>
                        <TableCell className="text-right text-xs font-medium" style={{ color: "hsl(210, 70%, 55%)" }}>{u.download_formatted}</TableCell>
                        <TableCell className="text-right text-xs font-bold">{u.total_formatted}</TableCell>
                        <TableCell>
                          <Badge variant={sb.variant} className="gap-1 text-xs"><StatusIcon className="h-3 w-3" />{sb.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.uptime}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResellerLayout>
  );
}
