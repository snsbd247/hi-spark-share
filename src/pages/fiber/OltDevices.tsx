import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Activity, Link2, Plug, Plus, Radio, RefreshCw, Trash2 } from "lucide-react";
import { oltApi, type OltDevice } from "@/lib/oltApi";
import { format } from "date-fns";
import OltMasterForm from "@/components/fiber/OltMasterForm";
import { Link as RouterLink } from "react-router-dom";

export default function OltDevices() {
  const [devices, setDevices] = useState<OltDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OltDevice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [list, unlinked] = await Promise.all([
        oltApi.list(),
        oltApi.unlinkedOnus().catch(() => []),
      ]);
      setDevices(list);
      setUnlinkedCount(unlinked.length);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load OLT devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (d: OltDevice) => { setEditing(d); setOpen(true); };

  const test = async (d: OltDevice) => {
    setBusyId(d.id);
    try {
      const r = await oltApi.test(d.id);
      r.ok ? toast.success(`Connected (${r.mode}): ${r.message ?? "ok"}`)
           : toast.error(`Failed: ${r.message ?? "connection error"}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Test failed");
    } finally {
      setBusyId(null);
    }
  };

  const poll = async (d: OltDevice) => {
    setBusyId(d.id);
    try {
      const r = await oltApi.poll(d.id);
      if (r.ok) toast.success(`Polled ${r.count ?? 0} ONUs (${r.mode})`);
      else toast.error(`Poll failed: ${r.error ?? "unknown"}`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Poll failed");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (d: OltDevice) => {
    if (!confirm(`Delete OLT "${d.name}"?\n\nNote: topology master (fiber_olts) is preserved.\nUse "Cascade delete" via API to remove both.`)) return;
    try {
      await oltApi.remove(d.id);
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="h-6 w-6 text-primary" /> OLT Devices
            </h1>
            <p className="text-sm text-muted-foreground">
              Single source of truth — adding an OLT here registers it on the topology + map automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add OLT</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit OLT" : "Add OLT (SSOT)"}</DialogTitle>
                </DialogHeader>
                <OltMasterForm
                  initial={editing}
                  onCancel={() => setOpen(false)}
                  onSaved={() => { setOpen(false); load(); }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {unlinkedCount > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{unlinkedCount} ONU{unlinkedCount > 1 ? "s" : ""} discovered, awaiting topology placement</div>
                  <div className="text-xs text-muted-foreground">Auto-detected by polling but not linked to any splitter output yet.</div>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <RouterLink to="/fiber/unlinked-onus">Review &amp; link</RouterLink>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Configured OLTs</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last polled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : devices.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No OLT devices configured.</TableCell></TableRow>
                ) : devices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.name}
                      {d.fiber_olt_id && (
                        <Badge variant="outline" className="ml-2 text-[10px]">SSOT</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="uppercase">{d.vendor}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{d.ip_address}:{d.port}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.location ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{d.connection_type}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={d.status === "online" ? "default" : d.status === "offline" ? "destructive" : "outline"}>
                        <Activity className="h-3 w-3 mr-1" /> {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.last_polled_at ? format(new Date(d.last_polled_at), "MMM d, HH:mm:ss") : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => test(d)}>
                        <Plug className="h-3 w-3 mr-1" /> Test
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => poll(d)}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Poll
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(d)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
