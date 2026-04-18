/**
 * SSOT OLT Master Form (Phase 15)
 *
 * Single reusable form that creates an OLT once across the system:
 *  - fiber_olts (topology master) + auto fiber_pon_ports
 *  - olt_devices (live monitoring + credentials)
 *
 * Used by:
 *  - /fiber/olt-devices  (Live Monitoring)
 *  - /fiber-topology     (Topology page)
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { oltApi, type OltDevice, type OltDeviceInput } from "@/lib/oltApi";
import { Loader2 } from "lucide-react";

interface Props {
  initial?: OltDevice | null;
  onSaved?: (d: OltDevice) => void;
  onCancel?: () => void;
}

const empty: OltDeviceInput = {
  name: "",
  ip_address: "",
  port: 22,
  username: "",
  password: "",
  vendor: "huawei",
  connection_type: "cli",
  poll_interval_sec: 300,
  is_active: true,
  location: "",
  lat: null,
  lng: null,
  total_pon_ports: 8,
};

export default function OltMasterForm({ initial, onSaved, onCancel }: Props) {
  const editing = !!initial;
  const [form, setForm] = useState<OltDeviceInput>(
    initial
      ? {
          name: initial.name,
          ip_address: initial.ip_address,
          port: initial.port,
          api_port: initial.api_port ?? undefined,
          username: initial.username ?? "",
          password: "",
          vendor: initial.vendor,
          connection_type: initial.connection_type,
          poll_interval_sec: initial.poll_interval_sec,
          is_active: initial.is_active,
          location: initial.location ?? "",
          lat: initial.lat ?? null,
          lng: initial.lng ?? null,
          total_pon_ports: initial.total_pon_ports ?? 8,
        }
      : empty,
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof OltDeviceInput>(k: K, v: OltDeviceInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.ip_address || !form.vendor) {
      toast.error("Name, IP address, and vendor are required");
      return;
    }
    setSaving(true);
    try {
      const payload: OltDeviceInput = { ...form };
      if (editing && !payload.password) delete (payload as any).password;
      const saved = editing
        ? await oltApi.update(initial!.id, payload)
        : await oltApi.create(payload);
      toast.success(editing ? "OLT updated" : "OLT created (topology + monitoring linked)");
      onSaved?.(saved);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          SSOT — single OLT across topology &amp; monitoring
        </Badge>
        {editing && initial?.fiber_olt_id && (
          <Badge variant="secondary" className="text-xs">
            Linked: fiber_olts/{initial.fiber_olt_id.slice(0, 8)}…
          </Badge>
        )}
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="basic">Identity</TabsTrigger>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="topology">Topology / Map</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-3 pt-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vendor *</Label>
              <Select value={form.vendor} onValueChange={(v) => set("vendor", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="huawei">Huawei</SelectItem>
                  <SelectItem value="zte">ZTE</SelectItem>
                  <SelectItem value="vsol">V-SOL</SelectItem>
                  <SelectItem value="bdcom">BDCOM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Total PON Ports</Label>
              <Input
                type="number"
                min={1}
                max={64}
                value={form.total_pon_ports ?? 8}
                disabled={editing}
                onChange={(e) => set("total_pon_ports", Number(e.target.value))}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="connection" className="space-y-3 pt-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>IP Address *</Label>
              <Input value={form.ip_address} onChange={(e) => set("ip_address", e.target.value)} />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                type="number"
                value={form.port ?? 22}
                onChange={(e) => set("port", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Connection Type</Label>
              <Select value={form.connection_type} onValueChange={(v) => set("connection_type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cli">CLI / SSH</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Poll interval (sec)</Label>
              <Input
                type="number"
                min={30}
                max={3600}
                value={form.poll_interval_sec ?? 300}
                onChange={(e) => set("poll_interval_sec", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Username</Label>
              <Input value={form.username ?? ""} onChange={(e) => set("username", e.target.value)} />
            </div>
            <div>
              <Label>Password {editing && <span className="text-xs text-muted-foreground">(leave empty to keep)</span>}</Label>
              <Input type="password" value={form.password ?? ""} onChange={(e) => set("password", e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <Label>Active (auto-poll)</Label>
          </div>
        </TabsContent>

        <TabsContent value="topology" className="space-y-3 pt-3">
          <div>
            <Label>Location / POP</Label>
            <Input
              value={form.location ?? ""}
              onChange={(e) => set("location", e.target.value)}
              placeholder="e.g. Dhaka POP-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.0000001"
                value={form.lat ?? ""}
                onChange={(e) => set("lat", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.0000001"
                value={form.lng ?? ""}
                onChange={(e) => set("lng", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These coordinates appear on the Network Map and Topology view.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>}
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {editing ? "Update OLT" : "Create OLT"}
        </Button>
      </div>
    </div>
  );
}
