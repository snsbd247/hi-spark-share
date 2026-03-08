import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

interface CustomerViewProps {
  customer: any;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    synced: "bg-success/10 text-success border-success/20",
    pending: "bg-warning/10 text-warning border-warning/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <Badge variant="outline" className={styles[status] || "bg-muted text-muted-foreground"}>
      {status}
    </Badge>
  );
}

export default function CustomerView({ customer }: CustomerViewProps) {
  const [retrying, setRetrying] = useState(false);

  const statusColor =
    customer.status === "active"
      ? "bg-success/10 text-success border-success/20"
      : customer.status === "suspended"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-muted text-muted-foreground";

  const retrySyncHandler = async () => {
    setRetrying(true);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mikrotik-sync/retry-sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: customer.id }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast.success("MikroTik sync successful");
      } else {
        toast.error(`Sync failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      toast.error("Could not connect to MikroTik");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xl font-bold text-foreground">{customer.name}</p>
          <p className="text-sm font-mono text-muted-foreground">{customer.customer_id}</p>
        </div>
        <Badge variant="outline" className={statusColor}>{customer.status}</Badge>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Father Name" value={customer.father_name} />
          <Field label="NID" value={customer.nid} />
          <Field label="Phone" value={customer.phone} />
          <Field label="Alt Phone" value={customer.alt_phone} />
          <Field label="Email" value={customer.email} />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Address</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Area" value={customer.area} />
          <Field label="Road" value={customer.road} />
          <Field label="House" value={customer.house} />
          <Field label="City" value={customer.city} />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Connection</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Package" value={customer.packages?.name} />
          <Field label="Monthly Bill" value={`৳${Number(customer.monthly_bill).toLocaleString()}`} />
          <Field label="IP Address" value={customer.ip_address} />
          <Field label="PPPoE Username" value={customer.pppoe_username} />
          <Field label="ONU MAC" value={customer.onu_mac} />
          <Field label="Router MAC" value={customer.router_mac} />
          <Field label="Router" value={customer.mikrotik_routers?.name} />
          <Field label="Installation Date" value={customer.installation_date} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">MikroTik Sync</h4>
          {customer.pppoe_username && (
            <Button variant="outline" size="sm" onClick={retrySyncHandler} disabled={retrying}>
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              {retrying ? "Syncing..." : "Retry Sync"}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Sync Status</p>
            <div className="mt-1">
              <SyncStatusBadge status={customer.mikrotik_sync_status || "pending"} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Connection Status</p>
            <div className="mt-1">
              <Badge variant="outline" className={
                customer.connection_status === "active" ? "bg-success/10 text-success border-success/20" :
                customer.connection_status === "suspended" ? "bg-destructive/10 text-destructive border-destructive/20" :
                "bg-muted text-muted-foreground"
              }>{customer.connection_status}</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
