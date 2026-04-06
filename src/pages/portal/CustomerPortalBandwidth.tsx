import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import PortalLayout from "@/components/layout/PortalLayout";
import CustomerLiveBandwidthWidget from "@/components/bandwidth/CustomerLiveBandwidthWidget";
import { Activity, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CustomerPortalBandwidth() {
  const { t } = useLanguage();
  const { customer } = useCustomerAuth();

  if (!customer?.id) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> Live Bandwidth
        </h1>
        <p className="text-muted-foreground mt-1">Real-time internet speed monitoring</p>
      </div>

      <CustomerLiveBandwidthWidget
        tenantId={customer.tenant_id || ""}
        customerId={customer.id}
      />
    </PortalLayout>
  );
}
