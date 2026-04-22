import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { WalletTimeline } from "./WalletTimeline";

export function CustomerTimelineDrawer({
  customerId,
  customerName,
  open,
  onOpenChange,
}: {
  customerId: string | null;
  customerName?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Wallet Timeline</SheetTitle>
          <SheetDescription>
            {customerName ? `Audit trail for ${customerName}` : "Audit trail"}
          </SheetDescription>
        </SheetHeader>
        {customerId && <WalletTimeline customerId={customerId} compact />}
      </SheetContent>
    </Sheet>
  );
}
