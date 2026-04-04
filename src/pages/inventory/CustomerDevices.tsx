import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { db } from "@/integrations/supabase/client";
import { useTenantId, scopeByTenant } from "@/hooks/useTenantId";
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
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  const qc = useQueryClient();
  const tenantId = useTenantId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    customer_id: "", product_id: "", serial_number: "", mac_address: "", ip_address: "", notes: "",
  });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["customer_devices", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeByTenant((db as any).from("customer_devices")
        .select("*,customer:customers(name,customer_id),product:products(name)")
        .order("assigned_at", { ascending: false }), tenantId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers_list", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant((db as any).from("customers").select("id,name,customer_id").order("name"), tenantId);
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      const { data } = await scopeByTenant((db as any).from("products").select("id,name,stock").order("name"), tenantId);
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
      if (form.product_id) {
        const prod = products.find((p: any) => p.id === form.product_id);
        if (prod && Number(prod.stock) <= 0) {
          throw new Error("Product is out of stock!");
        }
      }

      const { data: device, error } = await (db as any).from("customer_devices").insert({
        customer_id: form.customer_id,
        product_id: form.product_id || null,
        serial_number: form.serial_number || null,
        mac_address: form.mac_address || null,
        ip_address: form.ip_address || null,
        assigned_at: new Date().toISOString(),
        status: "active",
        notes: form.notes || null,
      }).select().single();
      if (error) throw error;

      if (form.product_id) {
        const prod = products.find((p: any) => p.id === form.product_id);
        const newStock = Math.max(0, (Number(prod?.stock) || 1) - 1);
        await (db as any).from("products").update({ stock: newStock }).eq("id", form.product_id);
        await (db as any).from("inventory_logs").insert({
          product_id: form.product_id, type: "out", quantity: 1,
          note: `Device assigned to customer`,
          reference_type: "customer_device", reference_id: device.id,
        });
      }

      if (form.serial_number) {
        await (db as any).from("product_serials").update({ status: "assigned" }).eq("serial_number", form.serial_number);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer_devices"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product_serials"] });
      qc.invalidateQueries({ queryKey: ["inventory_logs_recent"] });
      toast.success(t.inventory.deviceAssigned);
      setOpen(false);
      setForm({ customer_id: "", product_id: "", serial_number: "", mac_address: "", ip_address: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message || t.common.error),
  });

  const returnMut = useMutation({
    mutationFn: async (device: Device) => {
      await (db as any).from("customer_devices").update({ status: "returned" }).eq("id", device.id);
      if (device.product_id) {
        const prod = products.find((p: any) => p.id === device.product_id);
        const newStock = (Number(prod?.stock) || 0) + 1;
        await (db as any).from("products").update({ stock: newStock }).eq("id", device.product_id);
        await (db as any).from("inventory_logs").insert({
          product_id: device.product_id, type: "return", quantity: 1,
          note: "Device returned from customer",
          reference_type: "customer_device", reference_id: device.id,
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
      qc.invalidateQueries({ queryKey: ["inventory_logs_recent"] });
      toast.success(t.inventory.deviceReturned);
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
            <h1 className="text-2xl font-bold text-foreground">{t.inventory.customerDevices}</h1>
            <p className="text-muted-foreground text-sm">{t.inventory.trackDevices}</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> {t.inventory.assignDevice}</Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.inventory.searchDevices} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.inventory.allStatus}</SelectItem>
              <SelectItem value="active">{t.inventory.active}</SelectItem>
              <SelectItem value="returned">{t.inventory.returned}</SelectItem>
              <SelectItem value="damaged">{t.inventory.damaged}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tickets.customer}</TableHead>
                  <TableHead>{t.inventory.product}</TableHead>
                  <TableHead>{t.fiberTopology.serialNumber}</TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.inventory.assigned}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t.common.loading}</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t.inventory.noDevicesFound}</TableCell></TableRow>
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
                        <Button variant="outline" size="sm" onClick={() => { if (confirm(t.inventory.returnDevice)) returnMut.mutate(d); }}>
                          <RotateCcw className="h-3 w-3 mr-1" /> {t.inventory.returnBtn}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t.inventory.assignDeviceToCustomer}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t.tickets.customer} *</Label>
                <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t.inventory.selectCustomer} /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.customer_id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.inventory.product}</Label>
                <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v, serial_number: "" })}>
                  <SelectTrigger><SelectValue placeholder={t.inventory.selectProduct} /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({t.inventory.stock}: {p.stock})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.product_id && serials.length > 0 && (
                <div>
                  <Label>{t.fiberTopology.serialNumber}</Label>
                  <Select value={form.serial_number} onValueChange={v => setForm({ ...form, serial_number: v })}>
                    <SelectTrigger><SelectValue placeholder={t.inventory.selectSerial} /></SelectTrigger>
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
                  <Label>{t.inventory.serialNumberManual}</Label>
                  <Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} placeholder={t.inventory.enterSerialNumber} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t.fiberTopology.macAddress}</Label>
                  <Input value={form.mac_address} onChange={e => setForm({ ...form, mac_address: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" />
                </div>
                <div>
                  <Label>{t.customers.ipAddress}</Label>
                  <Input value={form.ip_address} onChange={e => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.x" />
                </div>
              </div>
              <div>
                <Label>{t.common.note}</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder={t.inventory.optionalNotes} />
              </div>
              <Button className="w-full" disabled={!form.customer_id || assignMut.isPending} onClick={() => assignMut.mutate()}>
                {assignMut.isPending ? t.common.loading : t.inventory.assignDevice}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
