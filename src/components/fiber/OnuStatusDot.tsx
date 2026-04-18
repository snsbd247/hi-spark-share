/**
 * Phase 12 — ONU live status dot + tooltip.
 * Lightweight indicator embedded in fiber tree / map markers.
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { statusVisual, type LiveOnuMeta } from "@/hooks/useLiveOnuStatusMap";
import { safeFormat } from "@/lib/utils";

export function OnuStatusDot({
  meta,
  size = "sm",
  onClick,
}: {
  meta?: LiveOnuMeta | null;
  size?: "xs" | "sm" | "md";
  onClick?: () => void;
}) {
  const v = statusVisual(meta?.status);
  const dim = size === "xs" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  const pulse = meta?.status === "online" ? "animate-pulse" : "";

  const dot = (
    <span
      onClick={onClick}
      className={cn(
        "inline-block rounded-full shrink-0 ring-1 ring-background",
        dim,
        v.dot,
        pulse,
        onClick && "cursor-pointer hover:scale-125 transition-transform",
      )}
    />
  );

  if (!meta) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{dot}</TooltipTrigger>
          <TooltipContent side="top" className="text-xs">No live data</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{dot}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs space-y-0.5">
          <div className="font-semibold">{v.label}</div>
          {meta.rx_power !== null && <div>Rx: <strong>{meta.rx_power.toFixed(2)} dBm</strong></div>}
          {meta.tx_power !== null && <div>Tx: <strong>{meta.tx_power.toFixed(2)} dBm</strong></div>}
          {meta.uptime && <div>Uptime: {meta.uptime}</div>}
          {meta.last_seen && (
            <div className="text-muted-foreground">
              Seen: {safeFormat(meta.last_seen, "MMM d, HH:mm:ss")}
            </div>
          )}
          {onClick && <div className="text-primary text-[10px] pt-1">Click for details →</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
