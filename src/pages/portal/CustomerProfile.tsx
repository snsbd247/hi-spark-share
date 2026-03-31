import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
import { useCustomerAuth, CustomerProfile as CustomerProfileType } from "@/contexts/CustomerAuthContext";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Wifi, Loader2, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

export default function CustomerProfile() {
  const { t } = useLanguage();
  const { customer, fetchProfile } = useCustomerAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["customer-full-profile", customer?.id],
    queryFn: async () => {
      try {
        const result = await fetchProfile();
        if (result) return result;
      } catch (e) {
        // Fallback to direct query
      }
      const { data } = await db
        .from("customers")
        .select("id, customer_id, name, phone, area, road, house, city, email, package_id, monthly_bill, ip_address, pppoe_username, onu_mac, router_mac, installation_date, status, username, father_name, mother_name, occupation, nid, alt_phone, permanent_address, gateway, subnet, discount, connectivity_fee, due_date_day, photo_url")
        .eq("id", customer!.id)
        .single();
      return data as CustomerProfileType | null;
    },
    enabled: !!customer?.id,
  });

  const { data: pkg, isLoading: pkgLoading } = useQuery({
    queryKey: ["customer-profile-package", customer?.package_id],
    queryFn: async () => {
      if (!customer?.package_id) return null;
      const { data, error } = await db
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
        <h1 className="text-2xl font-bold text-foreground">{t.portal.myProfile}</h1>
        <p className="text-muted-foreground mt-1">{t.portal.accountInfo}</p>
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
                  <CardTitle className="text-base">{t.portal.personalInformation}</CardTitle>
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
              <Field label={t.common.name} value={p?.name} />
              <Field label={t.portal.fatherName} value={p?.father_name} />
              <Field label={t.portal.motherName} value={p?.mother_name} />
              <Field label={t.portal.occupation} value={p?.occupation} />
              <Field label={t.common.phone} value={p?.phone} />
              <Field label={t.portal.altPhone} value={p?.alt_phone} />
              <Field label={t.common.email} value={p?.email} />
              <Field label={t.portal.nationalId} value={p?.nid} />
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
              <CardTitle className="text-base">{t.portal.addressTitle}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.portal.area} value={p?.area} />
              <Field label={t.portal.road} value={p?.road} />
              <Field label={t.portal.house} value={p?.house} />
              <Field label={t.portal.city} value={p?.city} />
            </div>
            <div className="mt-4">
              <Field label={t.portal.permanentAddress} value={p?.permanent_address} />
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
              <CardTitle className="text-base">{t.portal.connectionInformation}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label={t.portal.package} value={pkg?.name} />
              <Field label={t.portal.speed} value={pkg?.speed} />
              <Field label={t.portal.ipAddress} value={p?.ip_address} />
              <Field label={t.portal.gateway} value={p?.gateway} />
              <Field label={t.portal.subnet} value={p?.subnet} />
              <Field label={t.portal.pppoeUsername} value={p?.pppoe_username} />
              <Field label={t.portal.onuMac} value={p?.onu_mac} />
              <Field label={t.portal.routerMac} value={p?.router_mac} />
              <Field label={t.portal.installationDate} value={p?.installation_date} />
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
              <CardTitle className="text-base">{t.portal.billingInformation}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.portal.monthlyBill} value={`৳${monthlyBill.toLocaleString()}`} />
              <Field label={t.portal.discount} value={`৳${discount.toLocaleString()}`} />
              <Field label={t.portal.totalAmount} value={`৳${totalAmount.toLocaleString()}`} />
              <Field label={t.portal.dueDate} value={p?.due_date_day ? `${p.due_date_day}${t.portal.dueDateEveryMonth}` : "—"} />
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
