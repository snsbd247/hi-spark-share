import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { onuAlertApi, type OnuAlertLog } from "@/lib/onuAlertApi";
import { cn } from "@/lib/utils";

function eventBadge(ev: string) {
  switch (ev) {
    case "offline": return "bg-destructive/15 text-destructive border-destructive/30";
    case "los": return "bg-warning/15 text-warning border-warning/30";
    case "dying_gasp": return "bg-warning/15 text-warning border-warning/30";
    case "signal_low": return "bg-warning/15 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function OnuAlertLogsPage() {
  const [rows, setRows] = useState<OnuAlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [serial, setSerial] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await onuAlertApi.logs({ serial: serial || undefined }));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" /> ONU Alert Logs
            </h1>
            <p className="text-sm text-muted-foreground">History of dispatched alerts (Email + SMS).</p>
          </div>
          <div className="flex items-center gap-2">
            <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Filter by serial…" className="w-56" />
            <Button onClick={load} variant="outline" size="sm"><RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} /> Refresh</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent (last 500)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Prev → Curr</TableHead>
                  <TableHead>Rx</TableHead>
                  <TableHead>Channels Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No alerts yet</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.sent_at), "MMM d, HH:mm:ss")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                    <TableCell><Badge className={eventBadge(r.event_type)}>{r.event_type}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.previous_status ?? "-"} → {r.current_status ?? "-"}</TableCell>
                    <TableCell className="text-xs">{r.rx_power ?? "-"}</TableCell>
                    <TableCell className="space-x-1">
                      {r.channels_sent?.email && <Badge variant="secondary">Email ✓</Badge>}
                      {r.channels_sent?.sms && <Badge variant="secondary">SMS ✓</Badge>}
                      {!r.channels_sent?.email && !r.channels_sent?.sms && <Badge variant="outline" className="text-destructive">Failed</Badge>}
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
