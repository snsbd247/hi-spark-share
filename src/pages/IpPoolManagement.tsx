import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Network, Globe } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function IpPoolManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subnet: "", gateway: "", start_ip: "", end_ip: "", total_ips: 0 });

  const { data: pools = [] } = useQuery({
    queryKey: ["ip-pools"],
    queryFn: async () => {
      const { data, error } = await db.from("ip_pools").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (d: typeof form) => {
      const { error } = await db.from("ip_pools").insert(d);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ip-pools"] }); toast.success("IP Pool created"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("ip_pools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ip-pools"] }); toast.success("Deleted"); },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">IP Pool Management</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Pool</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create IP Pool</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Pool Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Main Pool" /></div>
                <div><Label>Subnet</Label><Input value={form.subnet} onChange={e => setForm(f => ({ ...f, subnet: e.target.value }))} placeholder="192.168.1.0/24" /></div>
                <div><Label>Gateway</Label><Input value={form.gateway} onChange={e => setForm(f => ({ ...f, gateway: e.target.value }))} placeholder="192.168.1.1" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Start IP</Label><Input value={form.start_ip} onChange={e => setForm(f => ({ ...f, start_ip: e.target.value }))} placeholder="192.168.1.10" /></div>
                  <div><Label>End IP</Label><Input value={form.end_ip} onChange={e => setForm(f => ({ ...f, end_ip: e.target.value }))} placeholder="192.168.1.254" /></div>
                </div>
                <div><Label>Total IPs</Label><Input type="number" value={form.total_ips} onChange={e => setForm(f => ({ ...f, total_ips: Number(e.target.value) }))} /></div>
                <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.subnet || createMutation.isPending} className="w-full">Create Pool</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map((pool: any) => {
            const usage = pool.total_ips > 0 ? Math.round((pool.used_ips / pool.total_ips) * 100) : 0;
            return (
              <Card key={pool.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4" /> {pool.name}</CardTitle>
                    <Badge variant={pool.status === "active" ? "default" : "secondary"}>{pool.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subnet:</span><span className="font-mono">{pool.subnet}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Gateway:</span><span className="font-mono">{pool.gateway || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Range:</span><span className="font-mono text-xs">{pool.start_ip} - {pool.end_ip}</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{pool.used_ips}/{pool.total_ips} used</span><span>{usage}%</span>
                    </div>
                    <Progress value={usage} className={`h-2 ${usage > 90 ? "[&>div]:bg-destructive" : ""}`} />
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => deleteMutation.mutate(pool.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {!pools.length && (
            <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground"><Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />No IP pools configured</CardContent></Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
