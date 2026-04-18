import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CreditCard, UserPlus, Receipt, Loader2, Wifi, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

const iconFor = (type: string) => {
  switch (type) {
    case "payment": return { Icon: CreditCard, cls: "text-success bg-success/10" };
    case "customer": return { Icon: UserPlus, cls: "text-primary bg-primary/10" };
    case "bill": return { Icon: Receipt, cls: "text-warning bg-warning/10" };
    case "router": return { Icon: Wifi, cls: "text-accent bg-accent/10" };
    default: return { Icon: AlertCircle, cls: "text-muted-foreground bg-muted/40" };
  }
};

export default function RecentActivityFeed() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;

  const { data, isLoading } = useQuery({
    queryKey: ["recent-activity-feed", tenantId],
    queryFn: async () => {
      let q: any = db.from("activity_logs")
        .select("id, action, description, module, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return (data || []).map((a: any) => ({
        ...a,
        type: a.module === "payments" ? "payment" : a.module === "customers" ? "customer" : a.module === "billing" ? "bill" : a.module === "mikrotik" ? "router" : "other",
      }));
    },
    refetchInterval: 30000,
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Recent Activity
          <span className="ml-auto h-2 w-2 rounded-full bg-success animate-pulse" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">কোনো recent activity নেই</p>
        ) : (
          <div className="relative space-y-3">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60" aria-hidden />
            {data.map((a: any) => {
              const { Icon, cls } = iconFor(a.type);
              return (
                <div key={a.id} className="relative flex items-start gap-3">
                  <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-card ${cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[13px] text-foreground leading-snug truncate">{a.description || a.action}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
