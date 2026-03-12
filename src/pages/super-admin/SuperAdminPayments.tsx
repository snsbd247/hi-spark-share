import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function SuperAdminPayments() {
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["sa-tenant-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions" as any)
        .select("*, tenants(company_name), subscription_plans(name, monthly_price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Payments</h1>
          <p className="text-muted-foreground text-sm">Tenant subscription payments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Records</CardTitle>
        </CardHeader>
        <CardContent>
          {!subscriptions?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No subscription records</p>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub: any) => (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{sub.tenants?.company_name || "Unknown Tenant"}</p>
                    <p className="text-xs text-muted-foreground">
                      Plan: {sub.subscription_plans?.name} — ৳{sub.subscription_plans?.monthly_price}/mo
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sub.status === "active" ? "default" : "destructive"}>{sub.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(sub.start_date), "dd MMM yyyy")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
