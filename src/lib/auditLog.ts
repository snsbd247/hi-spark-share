import { supabase } from "@/integrations/supabase/client";

interface AuditLogParams {
  adminId: string;
  adminName: string;
  action: "edit" | "delete";
  tableName: string;
  recordId: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
}

export async function logAudit({ adminId, adminName, action, tableName, recordId, oldData, newData }: AuditLogParams) {
  try {
    await supabase.from("audit_logs").insert({
      admin_id: adminId,
      admin_name: adminName,
      action,
      table_name: tableName,
      record_id: recordId,
      old_data: oldData || null,
      new_data: newData || null,
    });
  } catch (e) {
    console.error("Failed to log audit:", e);
  }
}
