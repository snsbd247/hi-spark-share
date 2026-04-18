/**
 * Phase 10 — ONU Alert Engine API client.
 */
import api from "@/lib/api";

export type AlertEvent = "offline" | "los" | "dying_gasp" | "signal_low" | "any";

export interface OnuAlertRule {
  id: string;
  tenant_id?: string | null;
  name: string;
  event_type: AlertEvent;
  rx_threshold_db?: number | null;
  cooldown_minutes: number;
  recipients_email: string[] | null;
  recipients_sms: string[] | null;
  channels: ("email" | "sms")[] | null;
  is_active: boolean;
  auto_suspend_pppoe?: boolean;
  created_at?: string;
}

export interface OnuAlertRuleInput {
  name: string;
  event_type: AlertEvent;
  rx_threshold_db?: number | null;
  cooldown_minutes?: number;
  recipients_email?: string[];
  recipients_sms?: string[];
  channels?: ("email" | "sms")[];
  is_active?: boolean;
  auto_suspend_pppoe?: boolean;
}

export interface OnuAlertLog {
  id: string;
  rule_id?: string | null;
  serial_number: string;
  event_type: string;
  previous_status?: string | null;
  current_status?: string | null;
  rx_power?: number | null;
  message?: string | null;
  channels_sent?: { email?: boolean; sms?: boolean } | null;
  errors?: Record<string, string[]> | null;
  sent_at: string;
}

export const onuAlertApi = {
  listRules: () => api.get<OnuAlertRule[]>("/api/fiber/alert-rules").then((r) => r.data),
  createRule: (body: OnuAlertRuleInput) =>
    api.post<OnuAlertRule>("/api/fiber/alert-rules", body).then((r) => r.data),
  updateRule: (id: string, body: Partial<OnuAlertRuleInput>) =>
    api.put<OnuAlertRule>(`/api/fiber/alert-rules/${id}`, body).then((r) => r.data),
  deleteRule: (id: string) => api.delete(`/api/fiber/alert-rules/${id}`).then((r) => r.data),
  logs: (params?: { serial?: string; event?: AlertEvent }) =>
    api.get<OnuAlertLog[]>("/api/fiber/alert-logs", { params }).then((r) => r.data),
};
