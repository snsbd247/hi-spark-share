import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "customers", "bills", "payments", "customer_ledger", "packages", "zones",
  "mikrotik_routers", "profiles", "user_roles", "custom_roles", "permissions",
  "role_permissions", "support_tickets", "ticket_replies", "sms_logs",
  "sms_settings", "sms_templates", "reminder_logs", "payment_gateways",
  "merchant_payments", "general_settings", "admin_sessions", "admin_login_logs",
  "audit_logs", "customer_sessions", "olts", "onus",
];

const MAX_BACKUP_SIZE_MB = 100; // 100MB limit
const RETENTION_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    // Cron-triggered actions use service role key auth (no user session)
    if (action === "auto" || action === "cleanup") {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== anonKey && token !== serviceKey) {
        return new Response(JSON.stringify({ error: "Unauthorized cron call" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "auto") {
        const backupType = body.backup_type || "auto_daily";
        return await createBackup(adminClient, "00000000-0000-0000-0000-000000000001", "backups", backupType);
      } else if (action === "cleanup") {
        return await cleanupOldBackups(adminClient);
      }
    }

    // User-triggered actions require full auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleData?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Only Super Admin can manage backups" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      return await createBackup(adminClient, userId, "backups", "manual");
    } else if (action === "create_sql") {
      return await createSqlBackup(adminClient, userId, "backups", "manual_sql");
    } else if (action === "emergency") {
      return await createBackup(adminClient, userId, "emergency", "emergency");
    } else if (action === "restore") {
      return await restoreBackup(adminClient, body.backup_data);
    } else if (action === "restore_sql") {
      return await restoreSqlBackup(adminClient, body.sql_content);
    } else if (action === "delete") {
      return await deleteBackup(adminClient, body.file_name);
    } else if (action === "manual_cleanup") {
      return await cleanupOldBackups(adminClient);
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Backup error:", err);
    return new Response(JSON.stringify({ error: err.message || "Backup operation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function createBackup(client: any, userId: string, bucket: string, backupType: string) {
  const backupData: Record<string, any[]> = {};

  for (const table of TABLES) {
    let allRows: any[] = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
      const { data, error } = await client.from(table).select("*").range(offset, offset + limit - 1);
      if (error) {
        console.error(`Error backing up ${table}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < limit) break;
      offset += limit;
    }
    backupData[table] = allRows;
  }

  const jsonStr = JSON.stringify({ version: "1.0", created_at: new Date().toISOString(), tables: backupData }, null, 2);
  const fileSize = new Blob([jsonStr]).size;

  // Check file size limit
  if (fileSize > MAX_BACKUP_SIZE_MB * 1024 * 1024) {
    const msg = `Backup size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds limit (${MAX_BACKUP_SIZE_MB}MB)`;
    console.error(msg);
    await client.from("backup_logs").insert({
      file_name: "size_limit_exceeded",
      backup_type: backupType,
      file_size: fileSize,
      created_by: userId,
      status: "failed",
      error_message: msg,
    });
    throw new Error(msg);
  }

  const now = new Date();
  const prefix = bucket === "emergency" ? "emergency" : "backup";
  const fileName = `${prefix}_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.json`;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(fileName, new Blob([jsonStr], { type: "application/json" }), {
      contentType: "application/json",
      upsert: false,
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  await client.from("backup_logs").insert({
    file_name: fileName,
    backup_type: backupType,
    file_size: fileSize,
    created_by: userId,
    status: "completed",
  });

  return new Response(JSON.stringify({ success: true, file_name: fileName, file_size: fileSize }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function cleanupOldBackups(client: any) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  // Get old backup logs
  const { data: oldBackups, error: queryError } = await client
    .from("backup_logs")
    .select("*")
    .lt("created_at", cutoffDate.toISOString())
    .neq("backup_type", "emergency"); // Never auto-delete emergency backups

  if (queryError) {
    console.error("Cleanup query error:", queryError.message);
    throw new Error(queryError.message);
  }

  let deletedCount = 0;
  const errors: string[] = [];

  for (const backup of oldBackups || []) {
    try {
      // Determine bucket from backup type
      const bucket = backup.backup_type === "emergency" ? "emergency" : "backups";
      const { error: storageError } = await client.storage.from(bucket).remove([backup.file_name]);
      if (storageError) {
        errors.push(`${backup.file_name}: ${storageError.message}`);
        continue;
      }
      await client.from("backup_logs").delete().eq("id", backup.id);
      deletedCount++;
    } catch (err: any) {
      errors.push(`${backup.file_name}: ${err.message}`);
    }
  }

  console.log(`Cleanup complete: ${deletedCount} backups deleted, ${errors.length} errors`);

  return new Response(JSON.stringify({
    success: true,
    deleted: deletedCount,
    total_found: oldBackups?.length || 0,
    errors,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function restoreBackup(client: any, backupData: any) {
  if (!backupData?.tables) throw new Error("Invalid backup data");

  const restoreOrder = [
    "general_settings", "packages", "zones", "mikrotik_routers",
    "customers", "bills", "payments", "customer_ledger",
    "profiles", "custom_roles", "permissions", "user_roles", "role_permissions",
    "support_tickets", "ticket_replies",
    "sms_settings", "sms_templates", "sms_logs", "reminder_logs",
    "payment_gateways", "merchant_payments",
    "admin_sessions", "admin_login_logs", "audit_logs",
    "customer_sessions", "olts", "onus",
  ];

  const deleteOrder = [...restoreOrder].reverse();

  for (const table of deleteOrder) {
    if (backupData.tables[table]) {
      const { error } = await client.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) console.error(`Delete ${table}:`, error.message);
    }
  }

  const errors: string[] = [];
  for (const table of restoreOrder) {
    const rows = backupData.tables[table];
    if (!rows || rows.length === 0) continue;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await client.from(table).insert(batch);
      if (error) {
        console.error(`Restore ${table}:`, error.message);
        errors.push(`${table}: ${error.message}`);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deleteBackup(client: any, fileName: string) {
  if (!fileName) throw new Error("File name required");

  const { error: storageError } = await client.storage.from("backups").remove([fileName]);
  if (storageError) throw new Error(`Delete failed: ${storageError.message}`);

  await client.from("backup_logs").delete().eq("file_name", fileName);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeSQL(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function createSqlBackup(client: any, userId: string, bucket: string, backupType: string) {
  const sqlParts: string[] = [
    `-- Database Backup (SQL Format)`,
    `-- Created: ${new Date().toISOString()}`,
    `-- Tables: ${TABLES.length}`,
    ``,
    `BEGIN;`,
    ``,
  ];

  for (const table of TABLES) {
    let allRows: any[] = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
      const { data, error } = await client.from(table).select("*").range(offset, offset + limit - 1);
      if (error) { console.error(`Error backing up ${table}:`, error.message); break; }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < limit) break;
      offset += limit;
    }

    if (allRows.length === 0) {
      sqlParts.push(`-- Table: ${table} (0 rows)`);
      sqlParts.push(``);
      continue;
    }

    sqlParts.push(`-- Table: ${table} (${allRows.length} rows)`);
    const columns = Object.keys(allRows[0]);
    const colList = columns.map(c => `"${c}"`).join(", ");

    for (const row of allRows) {
      const values = columns.map(c => escapeSQL(row[c])).join(", ");
      sqlParts.push(`INSERT INTO public."${table}" (${colList}) VALUES (${values});`);
    }
    sqlParts.push(``);
  }

  sqlParts.push(`COMMIT;`);
  const sqlStr = sqlParts.join("\n");
  const fileSize = new Blob([sqlStr]).size;

  if (fileSize > MAX_BACKUP_SIZE_MB * 1024 * 1024) {
    const msg = `SQL backup size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds limit (${MAX_BACKUP_SIZE_MB}MB)`;
    throw new Error(msg);
  }

  const now = new Date();
  const fileName = `backup_sql_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.sql`;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(fileName, new Blob([sqlStr], { type: "application/sql" }), {
      contentType: "application/sql",
      upsert: false,
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  await client.from("backup_logs").insert({
    file_name: fileName,
    backup_type: backupType,
    file_size: fileSize,
    created_by: userId,
    status: "completed",
  });

  return new Response(JSON.stringify({ success: true, file_name: fileName, file_size: fileSize }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
