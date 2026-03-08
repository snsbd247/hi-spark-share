import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { generateCustomerPDF } from "@/lib/pdf";

interface CustomerFormProps {
  customer?: any;
  onSuccess: () => void;
}

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
  });

  const { data: packages } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*").eq("is_active", true);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      monthly_bill: parseFloat(form.monthly_bill) || 0,
      package_id: form.package_id || null,
      installation_date: form.installation_date || null,
    };

    try {
      if (isEdit) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", customer.id);
        if (error) throw error;
        toast.success("Customer updated successfully");
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert({ ...payload, customer_id: "" })
          .select()
          .single();
        if (error) throw error;
        toast.success("Customer created successfully");
        // Generate PDF for new customer
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
            <Label>Area *</Label>
            <Input value={form.area} onChange={(e) => update("area", e.target.value)} required />
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
