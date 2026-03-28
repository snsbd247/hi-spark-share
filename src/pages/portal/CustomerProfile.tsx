import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth, CustomerProfile as CustomerProfileType } from "@/contexts/CustomerAuthContext";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Wifi, Loader2, CreditCard } from "lucide-react";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

export default function CustomerProfile() {
  const { customer, fetchProfile } = useCustomerAuth();

  // Fetch full profile from server (sensitive data never stored locally)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["customer-full-profile", customer?.id],
    queryFn: fetchProfile,
    enabled: !!customer,
  });

  const { data: pkg, isLoading: pkgLoading } = useQuery({
    queryKey: ["customer-profile-package", customer?.package_id],
    queryFn: async () => {
      if (!customer?.package_id) return null;
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("id", customer.package_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!customer?.package_id,
  });

  const statusColor =
    customer?.status === "active"
      ? "bg-success/10 text-success border-success/20"
      : "bg-destructive/10 text-destructive border-destructive/20";

  if (profileLoading || pkgLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  const p = profile;
  const monthlyBill = Number(p?.monthly_bill || 0);
  const discount = Number(p?.discount || 0);
  const totalAmount = monthlyBill - discount;

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-1">Your account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                {p?.photo_url ? (
                  <img src={p.photo_url} alt={p?.name} className="h-12 w-12 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-base">Personal Information</CardTitle>
                  <p className="text-sm text-muted-foreground font-mono">{p?.customer_id}</p>
                </div>
              </div>
              <Badge variant="outline" className={`ml-auto ${statusColor}`}>
                {p?.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" value={p?.name} />
              <Field label="Father Name" value={p?.father_name} />
              <Field label="Mother Name" value={p?.mother_name} />
              <Field label="Occupation" value={p?.occupation} />
              <Field label="Phone" value={p?.phone} />
              <Field label="Alt Phone" value={p?.alt_phone} />
              <Field label="Email" value={p?.email} />
              <Field label="National ID" value={p?.nid} />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <CardTitle className="text-base">Address</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Area" value={p?.area} />
              <Field label="Road" value={p?.road} />
              <Field label="House" value={p?.house} />
              <Field label="City" value={p?.city} />
            </div>
            <div className="mt-4">
              <Field label="Permanent Address" value={p?.permanent_address} />
            </div>
          </CardContent>
        </Card>

        {/* Connection Info */}
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Wifi className="h-5 w-5 text-success" />
              </div>
              <CardTitle className="text-base">Connection Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Package" value={pkg?.name} />
              <Field label="Speed" value={pkg?.speed} />
              <Field label="IP Address" value={p?.ip_address} />
              <Field label="Gateway" value={p?.gateway} />
              <Field label="Subnet" value={p?.subnet} />
              <Field label="PPPoE Username" value={p?.pppoe_username} />
              <Field label="ONU MAC" value={p?.onu_mac} />
              <Field label="Router MAC" value={p?.router_mac} />
              <Field label="Installation Date" value={p?.installation_date} />
            </div>
          </CardContent>
        </Card>

        {/* Billing Info */}
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-warning" />
              </div>
              <CardTitle className="text-base">Billing Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Monthly Bill" value={`৳${monthlyBill.toLocaleString()}`} />
              <Field label="Discount" value={`৳${discount.toLocaleString()}`} />
              
              <Field label="Total Amount" value={`৳${totalAmount.toLocaleString()}`} />
              <Field label="Due Date" value={p?.due_date_day ? `${p.due_date_day}th of every month` : "—"} />
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
