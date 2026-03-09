import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, Phone, MapPin, Package, Wifi, Calendar, CreditCard, Clock } from "lucide-react";

interface Props {
  customer: any;
  dueAmount: number;
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function CustomerInfoCard({ customer, dueAmount }: Props) {
  const statusColor =
    customer.connection_status === "active"
      ? "bg-success/10 text-success border-success/20"
      : customer.connection_status === "suspended"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-warning/10 text-warning border-warning/20";

  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">{customer.name}</h2>
            <p className="text-sm font-mono text-muted-foreground">{customer.customer_id}</p>
          </div>
          <Badge variant="outline" className={statusColor}>
            {customer.connection_status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          <Info icon={Phone} label="Phone" value={customer.phone} />
          <Info icon={MapPin} label="Zone / Area" value={customer.area} />
          <Info icon={Package} label="Package" value={customer.packages?.name} />
          <Info icon={CreditCard} label="Monthly Bill" value={`৳${Number(customer.monthly_bill).toLocaleString()}`} />
          <Info icon={Wifi} label="PPPoE Username" value={customer.pppoe_username} />
          <Info icon={Calendar} label="Connection Date" value={customer.installation_date} />
          <Info icon={Clock} label="Due Date (Day)" value={customer.due_date_day ? `${customer.due_date_day}th of every month` : "—"} />
          <Info icon={Calendar} label="Next Billing Date" value={(() => {
            if (!customer.due_date_day) return "—";
            const now = new Date();
            const day = customer.due_date_day;
            let next = new Date(now.getFullYear(), now.getMonth(), day);
            if (next <= now) next = new Date(now.getFullYear(), now.getMonth() + 1, day);
            return next.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          })()} />
          <div className="flex items-start gap-3">
            <CreditCard className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Current Due</p>
              <p className="text-sm font-bold text-destructive">৳{dueAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
