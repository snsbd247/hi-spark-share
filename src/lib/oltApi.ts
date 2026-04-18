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
  // SSOT topology mirror
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  total_pon_ports?: number | null;
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

export interface UnlinkedOnu {
  id: string;
  serial_number: string;
  mac_address?: string | null;
  olt_device_id?: string | null;
  pon_port_id?: string | null;
  discovered_at?: string | null;
  topology_status?: string | null;
  olt_name?: string | null;
  live_status?: string | null;
  rx_power?: number | null;
  tx_power?: number | null;
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
  // SSOT optional topology fields (used on create only)
  fiber_olt_id?: string | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  total_pon_ports?: number | null;
}

export const oltApi = {
  list: () => api.get<OltDevice[]>("/fiber/olt-devices").then((r) => r.data),
  get: (id: string) => api.get<OltDevice>(`/fiber/olt-devices/${id}`).then((r) => r.data),
  create: (payload: OltDeviceInput) =>
    api.post<OltDevice>("/fiber/olt-devices", payload).then((r) => r.data),
  update: (id: string, payload: Partial<OltDeviceInput>) =>
    api.put<OltDevice>(`/fiber/olt-devices/${id}`, payload).then((r) => r.data),
  remove: (id: string, cascade = false) =>
    api.delete<{ message: string; cascaded?: boolean }>(
      `/fiber/olt-devices/${id}${cascade ? "?cascade=1" : ""}`,
    ).then((r) => r.data),
  test: (id: string) =>
    api.post<{ ok: boolean; mode: string; message?: string; raw?: string }>(
      `/fiber/olt-devices/${id}/test`,
    ).then((r) => r.data),
  poll: (id: string) =>
    api.post<{ ok: boolean; mode?: string; count?: number; persisted?: { updated: number; inserted: number; linked?: number; signal_synced?: number }; error?: string }>(
      `/fiber/olt-devices/${id}/poll`,
    ).then((r) => r.data),
  liveStatus: (params?: { olt_device_id?: string; status?: string; search?: string }) =>
    api.get<OnuLiveStatus[]>("/fiber/onu-live-status", { params }).then((r) => r.data),
  // SSOT: list master ONUs with optional OLT/status/search filters (for dropdowns + tables)
  listOnus: (params?: { olt_device_id?: string; pon_port_id?: string; status?: string; search?: string; unlinked_only?: 0 | 1 }) =>
    api.get<Array<{
      id: string; serial_number: string; mac_address: string | null;
      olt_device_id: string | null; pon_port_id: string | null;
      splitter_output_id: string | null; customer_id: string | null;
      is_unlinked: boolean; topology_status: string | null;
      olt_name: string | null; customer_name: string | null; customer_code: string | null;
      live_status: string | null; rx_power: number | null; tx_power: number | null;
      olt_rx_power: number | null; last_seen: string | null; uptime: string | null;
    }>>("/fiber/onus", { params }).then((r) => r.data),
  // SSOT: unlinked ONUs (auto-discovered, awaiting topology placement)
  unlinkedOnus: (params?: { olt_device_id?: string }) =>
    api.get<UnlinkedOnu[]>("/fiber/onus/unlinked", { params }).then((r) => r.data),
  linkOnu: (id: string, payload: { splitter_output_id: string; customer_id?: string }) =>
    api.post<{ ok: boolean }>(`/fiber/onus/${id}/link`, payload).then((r) => r.data),
};
