import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { generateCustomerPDF } from "@/lib/pdf";

interface CustomerFormProps {
  customer?: any;
  onSuccess: () => void;
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export default function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const isEdit = !!customer;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    father_name: customer?.father_name ?? "",
    nid: customer?.nid ?? "",
    phone: customer?.phone ?? "",
    alt_phone: customer?.alt_phone ?? "",
    email: customer?.email ?? "",
    area: customer?.area ?? "",
    road: customer?.road ?? "",
    house: customer?.house ?? "",
    city: customer?.city ?? "",
    package_id: customer?.package_id ?? "",
    monthly_bill: customer?.monthly_bill?.toString() ?? "",
    ip_address: customer?.ip_address ?? "",
    pppoe_username: customer?.pppoe_username ?? "",
    pppoe_password: customer?.pppoe_password ?? "",
    onu_mac: customer?.onu_mac ?? "",
    router_mac: customer?.router_mac ?? "",
    installation_date: customer?.installation_date ?? "",
    status: customer?.status ?? "active",
    router_id: customer?.router_id ?? "",
  });

  const { data: packages } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: zones } = useQuery({
    queryKey: ["zones-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zones").select("*").eq("status", "active").order("area_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: routers } = useQuery({
    queryKey: ["mikrotik-routers-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mikrotik_routers").select("*").eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handlePackageChange = (packageId: string) => {
    update("package_id", packageId);
    const pkg = packages?.find((p) => p.id === packageId);
    if (pkg) update("monthly_bill", pkg.monthly_price.toString());
  };

  const syncPPPoE = async (customerId: string, customerData: any, pkg: any, isUpdate: boolean) => {
    const profileName = pkg?.mikrotik_profile_name || pkg?.name || "default";
    const endpoint = isUpdate ? "update-pppoe" : "create-pppoe";

    try {
      const body: any = {
        customer_id: customerId,
        pppoe_username: customerData.pppoe_username,
        pppoe_password: customerData.pppoe_password,
        profile_name: profileName,
        comment: `${customerData.name}`,
        router_id: customerData.router_id,
      };

      // If editing and username changed, pass old username
      if (isUpdate && customer?.pppoe_username && customer.pppoe_username !== customerData.pppoe_username) {
        body.old_pppoe_username = customer.pppoe_username;
      }

      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mikrotik-sync/${endpoint}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(`PPPoE user ${isUpdate ? "updated" : "created"} on MikroTik`);
      } else {
        toast.warning(`Customer saved but MikroTik sync failed: ${data.error || "Unknown error"}. You can retry later.`);
      }
    } catch (e: any) {
      console.error("MikroTik PPPoE sync failed:", e);
      toast.warning("Customer saved but MikroTik PPPoE sync failed. You can retry later.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: any = {
      name: form.name,
      father_name: form.father_name || null,
      nid: form.nid || null,
      phone: form.phone,
      alt_phone: form.alt_phone || null,
      email: form.email || null,
      area: form.area,
      road: form.road || null,
      house: form.house || null,
      city: form.city || null,
      package_id: form.package_id || null,
      monthly_bill: parseFloat(form.monthly_bill) || 0,
      ip_address: form.ip_address || null,
      pppoe_username: form.pppoe_username || null,
      pppoe_password: form.pppoe_password || null,
      onu_mac: form.onu_mac || null,
      router_mac: form.router_mac || null,
      installation_date: form.installation_date || null,
      status: form.status,
      router_id: form.router_id || null,
    };

    try {
      const pkg = packages?.find((p) => p.id === form.package_id);

      if (isEdit) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", customer.id);
        if (error) throw error;
        toast.success("Customer updated successfully");

        // Sync to MikroTik if PPPoE credentials exist
        const needsSync = form.router_id && form.pppoe_username && (
          customer.pppoe_username !== form.pppoe_username ||
          customer.pppoe_password !== form.pppoe_password ||
          customer.package_id !== form.package_id ||
          customer.router_id !== form.router_id
        );

        if (needsSync) {
          // Set sync status to pending
          await supabase.from("customers").update({ mikrotik_sync_status: "pending" }).eq("id", customer.id);
          await syncPPPoE(customer.id, payload, pkg, true);
        }

        // Handle status change → disable/enable PPPoE
        if (customer.status !== form.status && form.pppoe_username && form.router_id) {
          if (form.status === "suspended" || form.status === "disconnected") {
            try {
              await fetch(
                `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mikrotik-sync/disable-pppoe`,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pppoe_username: form.pppoe_username, router_id: form.router_id, customer_id: customer.id }) }
              );
            } catch { /* handled by edge function */ }
          } else if (form.status === "active" && (customer.status === "suspended" || customer.status === "disconnected")) {
            try {
              await fetch(
                `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mikrotik-sync/enable-pppoe`,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pppoe_username: form.pppoe_username, router_id: form.router_id, customer_id: customer.id }) }
              );
            } catch { /* handled by edge function */ }
          }
        }
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert({ ...payload, customer_id: "" })
          .select()
          .single();
        if (error) throw error;
        toast.success("Customer created successfully");

        // Auto-create PPPoE user on MikroTik
        if (data && form.router_id && form.pppoe_username) {
          await syncPPPoE(data.id, payload, pkg, false);
        }

        if (data) generateCustomerPDF(data);
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Info */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Customer Name *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Father Name</Label>
            <Input value={form.father_name} onChange={(e) => update("father_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>NID</Label>
            <Input value={form.nid} onChange={(e) => update("nid", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone *</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Alternative Phone</Label>
            <Input value={form.alt_phone} onChange={(e) => update("alt_phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Area / Zone *</Label>
            <Select value={form.area} onValueChange={(v) => update("area", v)}>
              <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones?.map((z) => (
                  <SelectItem key={z.id} value={z.area_name}>
                    {z.area_name}{z.address ? ` — ${z.address}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Road</Label>
            <Input value={form.road} onChange={(e) => update("road", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>House</Label>
            <Input value={form.house} onChange={(e) => update("house", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Connection */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Connection Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>MikroTik Router</Label>
            <Select value={form.router_id} onValueChange={(v) => update("router_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select router" /></SelectTrigger>
              <SelectContent>
                {routers?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} — {r.ip_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Package</Label>
            <Select value={form.package_id} onValueChange={handlePackageChange}>
              <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
              <SelectContent>
                {packages?.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} — {pkg.speed}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Bill *</Label>
            <Input type="number" value={form.monthly_bill} onChange={(e) => update("monthly_bill", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>IP Address</Label>
            <Input value={form.ip_address} onChange={(e) => update("ip_address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>PPPoE Username</Label>
            <Input value={form.pppoe_username} onChange={(e) => update("pppoe_username", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>PPPoE Password</Label>
            <Input value={form.pppoe_password} onChange={(e) => update("pppoe_password", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ONU MAC</Label>
            <Input value={form.onu_mac} onChange={(e) => update("onu_mac", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Router MAC</Label>
            <Input value={form.router_mac} onChange={(e) => update("router_mac", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Installation Date</Label>
            <Input type="date" value={form.installation_date} onChange={(e) => update("installation_date", e.target.value)} />
          </div>
        </div>
      </div>

      {/* System */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">System</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEdit ? "Update Customer" : "Save Customer"}
        </Button>
      </div>
    </form>
  );
}
