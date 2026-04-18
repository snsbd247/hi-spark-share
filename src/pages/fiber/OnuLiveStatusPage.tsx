import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, ArrowDown, ArrowUp, Download, RefreshCw, Search, Wifi } from "lucide-react";
import { oltApi, type OltDevice, type OnuLiveStatus } from "@/lib/oltApi";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { subscribeOnuStatus, getEcho } from "@/lib/echo";
import { useTenantId } from "@/hooks/useTenantId";

type SortKey = "serial_number" | "status" | "rx_power" | "tx_power" | "olt_rx_power" | "distance_m" | "last_seen";

function signalClass(rx?: number | null) {
  if (rx === null || rx === undefined) return "text-muted-foreground";
  if (rx > -20) return "text-success";
  if (rx > -25) return "text-warning";
  return "text-destructive";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "online": return "bg-success/15 text-success border-success/30";
    case "offline": return "bg-destructive/15 text-destructive border-destructive/30";
    case "los": return "bg-warning/15 text-warning border-warning/30";
    case "dying-gasp": return "bg-warning/15 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function OnuLiveStatusPage() {
  const [olts, setOlts] = useState<OltDevice[]>([]);
  const [rows, setRows] = useState<OnuLiveStatus[]>([]);
  const [oltFilter, setOltFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("last_seen");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [livePush, setLivePush] = useState<boolean>(() => !!getEcho());
  const [lastPushAt, setLastPushAt] = useState<string | null>(null);
  const tenantId = useTenantId();

  const oltNameById = useMemo(() => {
    const m: Record<string, string> = {};
    olts.forEach((o) => { m[o.id] = o.name; });
    return m;
  }, [olts]);

  const load = async () => {
    setLoading(true);
    try {
      const [oltList, statusList] = await Promise.all([
        oltApi.list(),
        oltApi.liveStatus({
          olt_device_id: oltFilter !== "all" ? oltFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: search || undefined,
        }),
      ]);
      setOlts(oltList);
      setRows(statusList);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load live status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [oltFilter, statusFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    // When live-push is active we can poll less aggressively (60s safety net),
    // otherwise stay at 15s.
    const interval = livePush ? 60000 : 15000;
    const id = setInterval(load, interval);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [autoRefresh, oltFilter, statusFilter, search, livePush]);

  // Phase 8: subscribe to live push — instant refresh on poll completion.
  useEffect(() => {
    const unsub = subscribeOnuStatus(tenantId, (payload) => {
      setLastPushAt(payload.polled_at);
      // If user is filtered to a different OLT, skip the auto-reload to avoid flicker.
      if (oltFilter !== "all" && oltFilter !== payload.olt_device_id) return;
      load();
    });
    setLivePush(!!getEcho());
    return unsub;
    // eslint-disable-next-line
  }, [tenantId, oltFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const online = rows.filter((r) => r.status === "online").length;
    const offline = rows.filter((r) => r.status === "offline").length;
    const los = rows.filter((r) => r.status === "los" || r.status === "dying-gasp").length;
    return { total, online, offline, los };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      const as = String(av); const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const exportCsv = () => {
    if (!sortedRows.length) { toast.info("No data to export"); return; }
    const headers = ["serial_number","olt","status","rx_power","tx_power","olt_rx_power","uptime","distance_m","last_seen"];
    const escape = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(",")];
    sortedRows.forEach((r) => {
      lines.push([
        r.serial_number,
        oltNameById[r.olt_device_id] || r.olt_device_id,
        r.status,
        r.rx_power ?? "",
        r.tx_power ?? "",
        r.olt_rx_power ?? "",
        r.uptime ?? "",
        r.distance_m ?? "",
        r.last_seen ?? "",
      ].map(escape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onu-live-status-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${sortedRows.length} rows`);
  };

  const SortHeader = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground transition">
        {children}
        {sortKey === k && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> ONU Live Status
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time signal & uptime per ONU (auto-refresh every 15s).
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh((v) => !v)}>
              <RefreshCw className={cn("h-4 w-4 mr-2", autoRefresh && "animate-spin")} /> Auto refresh
            </Button>
            <Button variant="outline" size="sm" onClick={load}>Refresh now</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total ONUs", value: stats.total, color: "bg-primary/10 text-primary" },
            { label: "Online", value: stats.online, color: "bg-success/15 text-success" },
            { label: "Offline", value: stats.offline, color: "bg-destructive/15 text-destructive" },
            { label: "LOS / Dying-gasp", value: stats.los, color: "bg-warning/15 text-warning" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={cn("text-2xl font-bold mt-1 inline-flex px-2 py-0.5 rounded", s.color)}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search by serial..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()} />
            </div>
            <Select value={oltFilter} onValueChange={setOltFilter}>
              <SelectTrigger><SelectValue placeholder="OLT" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All OLTs</SelectItem>
                {olts.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="los">LOS</SelectItem>
                <SelectItem value="dying-gasp">Dying-gasp</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={load}>Apply</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Live ONUs ({sortedRows.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader k="serial_number">Serial</SortHeader>
                  <TableHead>OLT</TableHead>
                  <SortHeader k="status">Status</SortHeader>
                  <SortHeader k="rx_power">RX (dBm)</SortHeader>
                  <SortHeader k="tx_power">TX (dBm)</SortHeader>
                  <SortHeader k="olt_rx_power">OLT RX</SortHeader>
                  <TableHead>Uptime</TableHead>
                  <SortHeader k="distance_m">Distance</SortHeader>
                  <SortHeader k="last_seen">Last seen</SortHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : sortedRows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No live data yet — add an OLT and poll.</TableCell></TableRow>
                ) : sortedRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                    <TableCell className="text-xs">{oltNameById[r.olt_device_id] || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className={cn("font-mono", signalClass(r.rx_power))}>{r.rx_power ?? "—"}</TableCell>
                    <TableCell className="font-mono">{r.tx_power ?? "—"}</TableCell>
                    <TableCell className={cn("font-mono", signalClass(r.olt_rx_power))}>{r.olt_rx_power ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.uptime ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.distance_m ? `${r.distance_m} m` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_seen ? format(new Date(r.last_seen), "MMM d, HH:mm:ss") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
