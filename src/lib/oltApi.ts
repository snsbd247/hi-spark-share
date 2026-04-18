/**
 * Live OLT Monitoring API client (Phase 2)
 * Isolated wrapper around /api/fiber/* endpoints. Does NOT touch existing fiber-topology client.
 */
import api from "@/lib/api";

export interface OltDevice {
  id: string;
  tenant_id?: string | null;
  fiber_olt_id?: string | null;
  name: string;
  ip_address: string;
  port: number;
  api_port?: number | null;
  username?: string | null;
  has_password: boolean;
  vendor: "huawei" | "zte" | "vsol" | "bdcom";
  connection_type: "api" | "cli" | "hybrid";
  status: "online" | "offline" | "unknown";
  poll_interval_sec: number;
  is_active: boolean;
  last_polled_at?: string | null;
  created_at?: string;
}

export interface OnuLiveStatus {
  id: string;
  onu_id?: string | null;
  olt_device_id: string;
  serial_number: string;
  status: string;
  rx_power?: number | null;
  tx_power?: number | null;
  olt_rx_power?: number | null;
  uptime?: string | null;
  distance_m?: number | null;
  last_seen?: string | null;
}

export interface OltDeviceInput {
  name: string;
  ip_address: string;
  port?: number;
  api_port?: number | null;
  username?: string;
  password?: string;
  vendor: OltDevice["vendor"];
  connection_type?: OltDevice["connection_type"];
  poll_interval_sec?: number;
  is_active?: boolean;
}

export const oltApi = {
  list: () => api.get<OltDevice[]>("/api/fiber/olt-devices").then((r) => r.data),
  get: (id: string) => api.get<OltDevice>(`/api/fiber/olt-devices/${id}`).then((r) => r.data),
  create: (payload: OltDeviceInput) =>
    api.post<OltDevice>("/api/fiber/olt-devices", payload).then((r) => r.data),
  update: (id: string, payload: Partial<OltDeviceInput>) =>
    api.put<OltDevice>(`/api/fiber/olt-devices/${id}`, payload).then((r) => r.data),
  remove: (id: string) =>
    api.delete<{ message: string }>(`/api/fiber/olt-devices/${id}`).then((r) => r.data),
  test: (id: string) =>
    api.post<{ ok: boolean; mode: string; message?: string; raw?: string }>(
      `/api/fiber/olt-devices/${id}/test`,
    ).then((r) => r.data),
  poll: (id: string) =>
    api.post<{ ok: boolean; mode?: string; count?: number; persisted?: { updated: number; inserted: number; linked?: number; signal_synced?: number }; error?: string }>(
      `/api/fiber/olt-devices/${id}/poll`,
    ).then((r) => r.data),
  liveStatus: (params?: { olt_device_id?: string; status?: string; search?: string }) =>
    api.get<OnuLiveStatus[]>("/api/fiber/onu-live-status", { params }).then((r) => r.data),
};
