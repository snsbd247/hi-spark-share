import api from "@/lib/api";

export interface OnuMikrotikSyncLog {
  id: string;
  tenant_id: string | null;
  customer_id: string | null;
  olt_device_id: string | null;
  serial_number: string;
  pppoe_username: string | null;
  action: "disable" | "enable";
  trigger_event: "offline" | "los" | "dying_gasp" | "recovered";
  previous_status: string | null;
  current_status: string;
  success: boolean;
  message: string | null;
  executed_at: string;
}

export const onuMikrotikSyncApi = {
  listLogs: (params: { serial?: string; customer_id?: string; action?: string } = {}) =>
    api.get<OnuMikrotikSyncLog[]>("/api/fiber/mikrotik-sync-logs", { params }).then((r) => r.data),
};
