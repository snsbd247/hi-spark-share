/**
 * Phase 14 — OLT Performance Dashboard API client.
 */
import api from "@/lib/api";

export interface OltOverviewCard {
  id: string;
  name: string;
  vendor: string;
  ip_address: string;
  status: string;
  is_active: boolean;
  last_polled_at: string | null;
  total_onus: number;
  online_onus: number;
  offline_onus: number;
  los_onus: number;
  weak_signal_count: number;
  avg_rx_power: number | null;
  alerts_24h: number;
  health_score: number | null;
  online_pct: number;
}

export interface OltOverviewResponse {
  devices: OltOverviewCard[];
  totals: {
    devices: number;
    total_onus: number;
    online_onus: number;
    alerts_24h: number;
  };
}

export interface OltPortMetric {
  port: string;
  total: number;
  online: number;
  offline: number;
  los: number;
  weak_signal: number;
  avg_rx: number | null;
  min_rx: number | null;
  max_rx: number | null;
  utilization_pct: number;
}

export interface OltDetailResponse {
  device: {
    id: string;
    name: string;
    vendor: string;
    ip_address: string;
    status: string;
    last_polled_at: string | null;
  };
  ports: OltPortMetric[];
  signal_distribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    no_data: number;
  };
  timeline_24h: Array<{
    hour: string;
    online: number;
    los: number;
    offline: number;
    avg_rx: number | null;
  }>;
  recent_alerts: Array<{
    id: string;
    serial: string;
    event_type: string;
    previous_status: string | null;
    current_status: string | null;
    sent_at: string;
  }>;
}

export const oltPerformanceApi = {
  overview: () =>
    api.get<OltOverviewResponse>("/api/fiber/olt-performance").then((r) => r.data),
  detail: (id: string) =>
    api.get<OltDetailResponse>(`/api/fiber/olt-performance/${id}`).then((r) => r.data),
};
