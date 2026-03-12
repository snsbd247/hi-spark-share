import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Loader2, Ban, Play } from "lucide-react";
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
  const [suspending, setSuspending] = useState(false);
  const [reactivating, setReactivating] = useState(false);

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
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customer.id }) }
      );
      const data = await res.json();
      if (data.success) toast.success("MikroTik sync successful");
      else toast.error(`Sync failed: ${data.error || "Unknown error"}`);
    } catch { toast.error("Could not connect to MikroTik"); } finally { setRetrying(false); }
  };

  const suspendPPPoE = async () => {
    if (!customer.pppoe_username) { toast.error("No PPPoE username"); return; }
    setSuspending(true);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mikrotik-sync/disable-pppoe`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pppoe_username: customer.pppoe_username, router_id: customer.router_id, customer_id: customer.id }) }
      );
      const data = await res.json();
      if (data.success) toast.success("PPPoE suspended on MikroTik");
      else toast.error(`Suspend failed: ${data.error || "Unknown"}`);
    } catch { toast.error("Could not connect to MikroTik"); } finally { setSuspending(false); }
  };

  const reactivatePPPoE = async () => {
    if (!customer.pppoe_username) { toast.error("No PPPoE username"); return; }
    setReactivating(true);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mikrotik-sync/enable-pppoe`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pppoe_username: customer.pppoe_username, router_id: customer.router_id, customer_id: customer.id }) }
      );
      const data = await res.json();
      if (data.success) toast.success("PPPoE reactivated on MikroTik");
      else toast.error(`Reactivate failed: ${data.error || "Unknown"}`);
    } catch { toast.error("Could not connect to MikroTik"); } finally { setReactivating(false); }
  };

  const monthlyBill = Number(customer.monthly_bill || 0);
  const discount = Number(customer.discount || 0);
  const connectivityFee = Number(customer.connectivity_fee || 0);
  const totalAmount = monthlyBill - discount + connectivityFee;

  return (
    <div className="space-y-6">
      {/* Header with photo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {customer.photo_url ? (
            <img src={customer.photo_url} alt={customer.name} className="h-16 w-16 rounded-lg object-cover border border-border" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center border border-border">
              <span className="text-muted-foreground text-xs">No Photo</span>
            </div>
          )}
          <div>
            <p className="text-xl font-bold text-foreground">{customer.name}</p>
            <p className="text-sm font-mono text-muted-foreground">{customer.customer_id}</p>
          </div>
        </div>
        <Badge variant="outline" className={statusColor}>{customer.status}</Badge>
      </div>

      <Separator />

      {/* Personal Information */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Information</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Father Name" value={customer.father_name} />
          <Field label="Mother Name" value={customer.mother_name} />
          <Field label="Occupation" value={customer.occupation} />
          <Field label="National ID" value={customer.nid} />
          <Field label="Phone" value={customer.phone} />
          <Field label="Alt Phone" value={customer.alt_phone} />
          <Field label="Email" value={customer.email} />
        </div>
      </div>

      {/* Address Information */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Address Information</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Zone / Area" value={customer.area} />
          <Field label="Road" value={customer.road} />
          <Field label="House" value={customer.house} />
          <Field label="City" value={customer.city} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
          <Field label="Village" value={customer.village} />
          <Field label="Post Office" value={customer.post_office} />
          <Field label="District" value={customer.district} />
        </div>
        <div className="mt-3">
          <Field label="Permanent Address" value={customer.permanent_address} />
        </div>
      </div>

      {/* Connection Details */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Connection Details</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Package" value={customer.packages?.name} />
          <Field label="PPPoE Username" value={customer.pppoe_username} />
          <Field label="PPPoE Password" value={customer.pppoe_password} />
          <Field label="IP Address" value={customer.ip_address} />
          <Field label="Gateway" value={customer.gateway} />
          <Field label="Subnet" value={customer.subnet} />
          <Field label="ONU MAC" value={customer.onu_mac} />
          <Field label="Router MAC" value={customer.router_mac} />
          <Field label="Router" value={customer.mikrotik_routers?.name} />
          <Field label="Connection Date" value={customer.installation_date} />
        </div>
      </div>

      {/* Billing Information */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Billing Information</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Monthly Bill" value={`৳${monthlyBill.toLocaleString()}`} />
          <Field label="Discount" value={`৳${discount.toLocaleString()}`} />
          <Field label="Connectivity Fee" value={`৳${connectivityFee.toLocaleString()}`} />
          <Field label="Total Amount" value={`৳${totalAmount.toLocaleString()}`} />
          <Field label="Due Date (Day)" value={customer.due_date_day ? `${customer.due_date_day}th of every month` : "—"} />
        </div>
      </div>

      {/* Office Use */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Office Use</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="POP Location" value={customer.pop_location} />
          <Field label="Installed By" value={customer.installed_by} />
          <Field label="Box Name" value={customer.box_name} />
          <Field label="Cable Length" value={customer.cable_length} />
        </div>
      </div>

      {/* MikroTik Sync */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">MikroTik Sync</h4>
          {customer.pppoe_username && (
            <div className="flex gap-2">
              {customer.connection_status !== "suspended" ? (
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={suspendPPPoE} disabled={suspending}>
                  {suspending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Ban className="h-3.5 w-3.5 mr-1.5" />}
                  Suspend PPPoE
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="text-success border-success/30 hover:bg-success/10" onClick={reactivatePPPoE} disabled={reactivating}>
                  {reactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                  Reactivate PPPoE
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={retrySyncHandler} disabled={retrying}>
                {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Retry Sync
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Sync Status</p>
            <div className="mt-1"><SyncStatusBadge status={customer.mikrotik_sync_status || "pending"} /></div>
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
