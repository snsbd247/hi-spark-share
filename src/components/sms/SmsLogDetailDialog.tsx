import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { safeFormat } from "@/lib/utils";

interface Props {
  log: any | null;
  tenantName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-3 gap-3 text-sm py-2 border-b border-border/50 last:border-0">
    <div className="text-muted-foreground">{label}</div>
    <div className="col-span-2 break-words">{children}</div>
  </div>
);

export default function SmsLogDetailDialog({ log, tenantName, open, onOpenChange }: Props) {
  if (!log) return null;

  const responseText = (() => {
    const r = log.response;
    if (r == null) return "—";
    if (typeof r === "string") return r;
    try { return JSON.stringify(r, null, 2); } catch { return String(r); }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>SMS Details</DialogTitle>
          <DialogDescription>Full message body, provider response, and metadata.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-1">
            <Row label="Time">{log.created_at ? safeFormat(log.created_at, "dd MMM yyyy HH:mm:ss") : "—"}</Row>
            {tenantName !== undefined && <Row label="Tenant">{tenantName || "—"}</Row>}
            <Row label="Phone"><span className="font-mono">{log.phone || "—"}</span></Row>
            <Row label="Type"><Badge variant="outline">{log.sms_type || "—"}</Badge></Row>
            <Row label="Status">
              <Badge variant={log.status === "sent" ? "default" : log.status === "failed" ? "destructive" : "secondary"}>
                {log.status || "—"}
              </Badge>
            </Row>
            <Row label="Segments">{log.sms_count ?? 1}</Row>
            {log.cost != null && <Row label="Cost">{Number(log.cost).toFixed(4)}</Row>}
            {log.admin_cost != null && <Row label="Admin cost">{Number(log.admin_cost).toFixed(4)}</Row>}
            {log.profit != null && <Row label="Profit">{Number(log.profit).toFixed(4)}</Row>}
            {log.customer_id && <Row label="Customer ID"><span className="font-mono text-xs">{log.customer_id}</span></Row>}
            {log.customers?.name && <Row label="Customer">{log.customers.name}</Row>}
            <Row label="Message">
              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 p-3 rounded-md">{log.message || "—"}</pre>
            </Row>
            <Row label="Provider response">
              <pre className="whitespace-pre-wrap font-mono text-xs bg-muted/40 p-3 rounded-md max-h-60 overflow-auto">{responseText}</pre>
            </Row>
            {log.id && <Row label="Log ID"><span className="font-mono text-xs">{log.id}</span></Row>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
