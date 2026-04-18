/**
 * Phase 12 — Live ONU status overlay hook.
 *
 * Polls /api/fiber/onu-live-status every `intervalMs` and returns a Map
 * keyed by UPPER-CASE serial number. Silent failure (returns empty map)
 * so callers can render gracefully when the backend is unreachable.
 *
 * Shared by FiberTopology tree, NetworkMap, and details drawer.
 */
import { useEffect, useRef, useState } from "react";
import { oltApi, type OnuLiveStatus } from "@/lib/oltApi";

export interface LiveOnuMeta {
  status: string;
  rx_power: number | null;
  tx_power: number | null;
  olt_rx_power: number | null;
  uptime: string | null;
  last_seen: string | null;
  olt_device_id: string;
}

export interface UseLiveOnuStatusMapResult {
  bySn: Record<string, LiveOnuMeta>;
  total: number;
  online: number;
  offline: number;
  los: number;
  lastUpdated: Date | null;
  loading: boolean;
  refresh: () => void;
}

const EMPTY: UseLiveOnuStatusMapResult = {
  bySn: {},
  total: 0,
  online: 0,
  offline: 0,
  los: 0,
  lastUpdated: null,
  loading: true,
  refresh: () => {},
};

export function normalizeSn(sn: string | null | undefined): string | null {
  if (!sn) return null;
  return String(sn).trim().toUpperCase();
}

export function useLiveOnuStatusMap(intervalMs = 30000): UseLiveOnuStatusMapResult {
  const [state, setState] = useState<UseLiveOnuStatusMapResult>(EMPTY);
  const cancelledRef = useRef(false);

  const load = async () => {
    try {
      const rows = await oltApi.liveStatus();
      if (cancelledRef.current) return;
      const bySn: Record<string, LiveOnuMeta> = {};
      let online = 0, offline = 0, los = 0;
      (rows || []).forEach((r: OnuLiveStatus) => {
        const sn = normalizeSn(r.serial_number);
        if (!sn) return;
        bySn[sn] = {
          status: r.status,
          rx_power: r.rx_power ?? null,
          tx_power: r.tx_power ?? null,
          olt_rx_power: r.olt_rx_power ?? null,
          uptime: r.uptime ?? null,
          last_seen: r.last_seen ?? null,
          olt_device_id: r.olt_device_id,
        };
        if (r.status === "online") online++;
        else if (r.status === "offline") offline++;
        else if (r.status === "los" || r.status === "dying-gasp") los++;
      });
      setState({
        bySn,
        total: Object.keys(bySn).length,
        online,
        offline,
        los,
        lastUpdated: new Date(),
        loading: false,
        refresh: load,
      });
    } catch {
      // Silent — overlay simply hides
      setState((s) => ({ ...s, loading: false, refresh: load }));
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      cancelledRef.current = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return state;
}

export const STATUS_COLOR: Record<string, { dot: string; bg: string; border: string; label: string }> = {
  online:       { dot: "bg-success",     bg: "bg-success/15",     border: "border-success/40",     label: "Online" },
  offline:      { dot: "bg-muted-foreground", bg: "bg-muted/30",  border: "border-muted-foreground/40", label: "Offline" },
  los:          { dot: "bg-destructive", bg: "bg-destructive/15", border: "border-destructive/40", label: "LOS" },
  "dying-gasp": { dot: "bg-warning",     bg: "bg-warning/15",     border: "border-warning/40",     label: "Dying-gasp" },
  unknown:      { dot: "bg-muted",       bg: "bg-muted/20",       border: "border-border",         label: "Unknown" },
};

export function statusVisual(status?: string | null) {
  if (!status) return STATUS_COLOR.unknown;
  return STATUS_COLOR[status] || STATUS_COLOR.unknown;
}
