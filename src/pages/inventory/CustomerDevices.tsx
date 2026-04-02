import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Device {
  id: string;
  customer_id: string;
  product_id: string;
  serial_number: string;
  mac_address: string;
  ip_address: string;
  assigned_at: string;
  status: string;
  notes: string;
  customer?: { name: string; customer_id: string };
  product?: { name: string };
}

export default function CustomerDevices() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    customer_id: "", product_id: "", serial_number: "", mac_address: "", ip_address: "", notes: "",
  });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["customer_devices"],
    queryFn: async () => {
      const { data } = await (db as any).from("customer_devices")
        .select("*,customer:customers(name,customer_id),product:products(name)")
        .order("assigned_at", { ascending: false });
      return data || [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers_list"],
    queryFn: async () => {
      const { data } = await (db as any).from("customers").select("id,name,customer_id").order("name");
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await (db as any).from("products").select("id,name,stock").order("name");
      return data || [];
    },
  });

  const { data: serials = [] } = useQuery({
    queryKey: ["available_serials", form.product_id],
    queryFn: async () => {
      if (!form.product_id) return [];
      const { data } = await (db as any).from("product_serials")
        .select("id,serial_number")
        .eq("product_id", form.product_id)
        .eq("status", "available");
      return data || [];
    },
    enabled: !!form.product_id,
  });

  const assignMut = useMutation({
    mutationFn: async () => {
      // Create device record
      const { error } = await (db as any).from("customer_devices").insert({
        customer_id: form.customer_id,
        product_id: form.product_id || null,
        serial_number: form.serial_number || null,
        mac_address: form.mac_address || null,
        ip_address: form.ip_address || null,
        assigned_at: new Date().toISOString(),
        status: "active",
        notes: form.notes || null,
      });
      if (error) throw error;

      // Decrement stock
      if (form.product_id) {
        await (db as any).from("products").update({ stock: (products.find((p: any) => p.id === form.product_id)?.stock || 1) - 1 }).eq("id", form.product_id);

        await (db as any).from("inventory_logs").insert({
          product_id: form.product_id,
          type: "out",
          quantity: 1,
          note: "Device assigned to customer",
        });
      }

      // Mark serial assigned
      if (form.serial_number) {
        await (db as any).from("product_serials").update({ status: "assigned" }).eq("serial_number", form.serial_number);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer_devices"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product_serials"] });
      qc.invalidateQueries({ queryKey: ["inventory_logs_recent"] });
      toast.success("Device assigned successfully");
      setOpen(false);
      setForm({ customer_id: "", product_id: "", serial_number: "", mac_address: "", ip_address: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to assign device"),
  });

  const returnMut = useMutation({
    mutationFn: async (device: Device) => {
      await (db as any).from("customer_devices").update({ status: "returned" }).eq("id", device.id);
      if (device.product_id) {
        const prod = products.find((p: any) => p.id === device.product_id);
        await (db as any).from("products").update({ stock: (prod?.stock || 0) + 1 }).eq("id", device.product_id);
        await (db as any).from("inventory_logs").insert({
          product_id: device.product_id, type: "return", quantity: 1, note: "Device returned from customer",
        });
      }
      if (device.serial_number) {
        await (db as any).from("product_serials").update({ status: "available" }).eq("serial_number", device.serial_number);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer_devices"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product_serials"] });
      toast.success("Device returned");
    },
  });

  const filtered = devices.filter((d: Device) => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      d.serial_number?.toLowerCase().includes(s) ||
      d.mac_address?.toLowerCase().includes(s) ||
      d.customer?.name?.toLowerCase().includes(s) ||
      d.product?.name?.toLowerCase().includes(s);
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Customer Devices</h1>
            <p className="text-muted-foreground text-sm">Track devices assigned to customers</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Assign Device</Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search devices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No devices found</TableCell></TableRow>
                ) : filtered.map((d: Device) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{d.customer?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{d.customer?.customer_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>{d.product?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{d.serial_number || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{d.mac_address || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{d.ip_address || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "active" ? "default" : d.status === "returned" ? "secondary" : "destructive"}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.assigned_at ? new Date(d.assigned_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.status === "active" && (
                        <Button variant="outline" size="sm" onClick={() => { if (confirm("Return this device?")) returnMut.mutate(d); }}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Return
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Assign Device Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Assign Device to Customer</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Customer *</Label>
                <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.customer_id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Product</Label>
                <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v, serial_number: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.product_id && serials.length > 0 && (
                <div>
                  <Label>Serial Number</Label>
                  <Select value={form.serial_number} onValueChange={v => setForm({ ...form, serial_number: v })}>
                    <SelectTrigger><SelectValue placeholder="Select serial" /></SelectTrigger>
                    <SelectContent>
                      {serials.map((s: any) => (
                        <SelectItem key={s.id} value={s.serial_number}>{s.serial_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(!form.product_id || serials.length === 0) && (
                <div>
                  <Label>Serial Number (manual)</Label>
                  <Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} placeholder="Enter serial number" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>MAC Address</Label>
                  <Input value={form.mac_address} onChange={e => setForm({ ...form, mac_address: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" />
                </div>
                <div>
                  <Label>IP Address</Label>
                  <Input value={form.ip_address} onChange={e => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.x" />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
              </div>
              <Button className="w-full" disabled={!form.customer_id || assignMut.isPending} onClick={() => assignMut.mutate()}>
                {assignMut.isPending ? "Assigning..." : "Assign Device"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
