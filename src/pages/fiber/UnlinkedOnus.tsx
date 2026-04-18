/**
 * SSOT Unlinked ONUs (Phase 15)
 *
 * ONUs auto-discovered by OLT polling but not yet placed on the fiber topology.
 * Operators link them to a splitter output here → master ONU row stays the same
 * (no duplication anywhere).
 */
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { oltApi, type UnlinkedOnu } from "@/lib/oltApi";
import { Link as LinkIcon, RefreshCw, Radio } from "lucide-react";
import { format } from "date-fns";

export default function UnlinkedOnus() {
  const [rows, setRows] = useState<UnlinkedOnu[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<UnlinkedOnu | null>(null);
  const [splitterOutputId, setSplitterOutputId] = useState("");
  const [customerId, setCustomerId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await oltApi.unlinkedOnus());
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load unlinked ONUs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submitLink = async () => {
    if (!linking || !splitterOutputId) {
      toast.error("Splitter output ID required");
      return;
    }
    try {
      await oltApi.linkOnu(linking.id, {
        splitter_output_id: splitterOutputId,
        customer_id: customerId || undefined,
      });
      toast.success("ONU linked to topology");
      setLinking(null);
      setSplitterOutputId("");
      setCustomerId("");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Link failed");
    }
  };

  const signalBadge = (rx?: number | null) => {
    if (rx == null) return <Badge variant="outline">—</Badge>;
    if (rx >= -25) return <Badge className="bg-primary/10 text-primary border-primary/30">{rx} dBm</Badge>;
    if (rx >= -27) return <Badge className="bg-accent text-accent-foreground border-border">{rx} dBm</Badge>;
    return <Badge variant="destructive">{rx} dBm</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="h-6 w-6 text-primary" />
              Unlinked ONUs
            </h1>
            <p className="text-muted-foreground text-sm">
              ONUs discovered by OLT polling but not yet placed on the fiber topology.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Awaiting topology placement <Badge variant="secondary" className="ml-2">{rows.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>OLT</TableHead>
                  <TableHead>Live Status</TableHead>
                  <TableHead>Rx Power</TableHead>
                  <TableHead>Discovered</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {loading ? "Loading…" : "All ONUs are placed on the topology ✓"}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                    <TableCell>{r.olt_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.live_status === "online" ? "default" : "outline"}>
                        {r.live_status ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>{signalBadge(r.rx_power)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.discovered_at ? format(new Date(r.discovered_at), "MMM d, HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_seen ? format(new Date(r.last_seen), "MMM d, HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setLinking(r)}>
                        <LinkIcon className="h-3.5 w-3.5 mr-1" />
                        Link
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!linking} onOpenChange={(o) => !o && setLinking(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Place ONU on topology</DialogTitle>
            </DialogHeader>
            {linking && (
              <div className="space-y-3">
                <div className="text-sm bg-muted p-3 rounded">
                  <div><span className="text-muted-foreground">Serial:</span> <span className="font-mono">{linking.serial_number}</span></div>
                  <div><span className="text-muted-foreground">OLT:</span> {linking.olt_name}</div>
                </div>
                <div>
                  <Label>Splitter Output ID *</Label>
                  <Input
                    value={splitterOutputId}
                    onChange={(e) => setSplitterOutputId(e.target.value)}
                    placeholder="UUID of the available splitter output"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Find an unused output on the Topology page.
                  </p>
                </div>
                <div>
                  <Label>Customer ID (optional)</Label>
                  <Input
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="Link to a customer record"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinking(null)}>Cancel</Button>
              <Button onClick={submitLink}>Link to topology</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
