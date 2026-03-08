import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Loader2, Search, Radio } from "lucide-react";
import { toast } from "sonner";

export default function ONUManagement() {
  const [formOpen, setFormOpen] = useState(false);
  const [editOnu, setEditOnu] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    serial_number: "", mac_address: "", customer_id: "", olt_id: "", olt_port: "", signal_strength: "", status: "online",
  });
  const queryClient = useQueryClient();

  const { data: onus, isLoading } = useQuery({
    queryKey: ["onus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onus")
        .select("*, customers(customer_id, name), olts(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, customer_id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: olts } = useQuery({
    queryKey: ["olts-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("olts").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = onus?.filter(
    (o) =>
      o.serial_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.mac_address || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.customers?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.customers?.customer_id || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditOnu(null);
    setForm({ serial_number: "", mac_address: "", customer_id: "", olt_id: "", olt_port: "", signal_strength: "", status: "online" });
    setFormOpen(true);
  };

  const openEdit = (onu: any) => {
    setEditOnu(onu);
    setForm({
      serial_number: onu.serial_number,
      mac_address: onu.mac_address || "",
      customer_id: onu.customer_id || "",
      olt_id: onu.olt_id || "",
      olt_port: onu.olt_port || "",
      signal_strength: onu.signal_strength || "",
      status: onu.status,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      serial_number: form.serial_number,
      mac_address: form.mac_address || null,
      customer_id: form.customer_id || null,
      olt_id: form.olt_id || null,
      olt_port: form.olt_port || null,
      signal_strength: form.signal_strength || null,
      status: form.status,
    };
    try {
      if (editOnu) {
        const { error } = await supabase.from("onus").update(payload).eq("id", editOnu.id);
        if (error) throw error;
        toast.success("ONU updated");
      } else {
        const { error } = await supabase.from("onus").insert(payload);
        if (error) throw error;
        toast.success("ONU added");
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["onus"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-success/10 text-success border-success/20";
      case "offline": return "bg-muted text-muted-foreground";
      case "faulty": return "bg-destructive/10 text-destructive border-destructive/20";
      case "unregistered": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ONU Management</h1>
          <p className="text-muted-foreground mt-1">Manage Optical Network Units</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add ONU</Button>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ONUs..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>OLT</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No ONUs found</TableCell></TableRow>
                ) : (
                  filtered?.map((onu) => (
                    <TableRow key={onu.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Radio className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{onu.serial_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{onu.mac_address || "—"}</TableCell>
                      <TableCell>
                        {onu.customers ? (
                          <div>
                            <p className="font-medium text-sm">{onu.customers.name}</p>
                            <p className="text-xs text-muted-foreground">{onu.customers.customer_id}</p>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{onu.olts?.name || "—"}</TableCell>
                      <TableCell>{onu.olt_port || "—"}</TableCell>
                      <TableCell>
                        {onu.signal_strength ? (
                          <span className="font-mono text-sm">{onu.signal_strength} dBm</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor(onu.status)}>{onu.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(onu)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editOnu ? "Edit ONU" : "Add ONU"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Serial Number *</Label>
                <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>MAC Address</Label>
                <Input placeholder="AA:BB:CC:DD:EE:FF" value={form.mac_address} onChange={(e) => setForm({ ...form, mac_address: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.customer_id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>OLT</Label>
                <Select value={form.olt_id} onValueChange={(v) => setForm({ ...form, olt_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select OLT" /></SelectTrigger>
                  <SelectContent>
                    {olts?.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>OLT Port</Label>
                <Input placeholder="e.g. 1/1/1" value={form.olt_port} onChange={(e) => setForm({ ...form, olt_port: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Signal (dBm)</Label>
                <Input placeholder="-18.5" value={form.signal_strength} onChange={(e) => setForm({ ...form, signal_strength: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="faulty">Faulty</SelectItem>
                    <SelectItem value="unregistered">Unregistered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editOnu ? "Update" : "Add ONU"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
