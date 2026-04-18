/**
 * Phase 13 — Customer Portal Connection Health API client.
 * Talks to /api/portal/connection-health (customer.auth middleware).
 */
import api from "@/lib/api";

export type HealthVerdict = "healthy" | "degraded" | "critical" | "offline" | "unknown";

export interface ConnectionHealthResponse {
  has_device: boolean;
  message?: string;
  verdict?: HealthVerdict;
  serial?: string;
  live?: {
    status: string;
    rx_power: number | null;
    tx_power: number | null;
    uptime: string | null;
    last_seen: string | null;
  } | null;
  uptime_24h_pct?: number | null;
  trend_points?: Array<{
    rx_power: number | null;
    status: string | null;
    recorded_at: string;
  }>;
  recent_outages?: Array<{
    id: string;
    event_type: string;
    previous_status: string | null;
    current_status: string | null;
    sent_at: string;
  }>;
}

export const connectionHealthApi = {
  get: () =>
    api
      .get<ConnectionHealthResponse>("/api/portal/connection-health")
      .then((r) => r.data),
};
