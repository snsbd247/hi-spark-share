import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Power, PowerOff, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { onuMikrotikSyncApi, type OnuMikrotikSyncLog } from "@/lib/onuMikrotikSyncApi";
import { safeFormat } from "@/lib/utils";

export default function OnuMikrotikSyncLogsPage() {
  const [rows, setRows] = useState<OnuMikrotikSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [serial, setSerial] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await onuMikrotikSyncApi.listLogs(serial ? { serial } : {}));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load sync logs");
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
              <Wrench className="h-6 w-6 text-primary" /> MikroTik ↔ ONU Auto-Sync Logs
            </h1>
            <p className="text-sm text-muted-foreground">
              Audit trail of automatic PPPoE suspend/restore actions triggered by ONU status changes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by ONU serial…"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              className="w-56"
            />
            <Button onClick={load} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Actions (last 500)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>ONU Serial</TableHead>
                  <TableHead>PPPoE</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Transition</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No auto-sync actions yet</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{safeFormat(r.executed_at, "yyyy-MM-dd HH:mm:ss")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                    <TableCell className="font-mono text-xs">{r.pppoe_username || "—"}</TableCell>
                    <TableCell>
                      {r.action === "disable" ? (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                          <PowerOff className="h-3 w-3 mr-1" /> Disable
                        </Badge>
                      ) : (
                        <Badge className="bg-success/15 text-success border-success/30">
                          <Power className="h-3 w-3 mr-1" /> Enable
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.trigger_event}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.previous_status ?? "—"} → {r.current_status}
                    </TableCell>
                    <TableCell>
                      {r.success ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={r.message || ""}>
                      {r.message || "—"}
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
