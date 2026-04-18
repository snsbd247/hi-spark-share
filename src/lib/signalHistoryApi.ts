/**
 * Phase 9 — Historical signal trend API client.
 */
import api from "@/lib/api";

export interface SignalPoint {
  rx_power: number | null;
  tx_power: number | null;
  olt_rx_power: number | null;
  status: string | null;
  recorded_at: string;
}

export interface SignalHistoryResponse {
  serial: string;
  range: "24h" | "7d" | "30d";
  count: number;
  points: SignalPoint[];
  degradation: null | {
    first_avg: number;
    last_avg: number;
    delta_db: number;
    degraded: boolean;
  };
}

export const signalHistoryApi = {
  get: (serial: string, range: "24h" | "7d" | "30d" = "24h") =>
    api
      .get<SignalHistoryResponse>("/api/fiber/onu-signal-history", {
        params: { serial, range },
      })
      .then((r) => r.data),
};
