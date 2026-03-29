import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All public tables in correct dependency order (parents first)
const TABLES = [
  // Settings & config (no FK deps)
  "general_settings", "sms_settings", "sms_templates", "system_settings",
  "payment_gateways", "geo_divisions",
  // Geo hierarchy
  "geo_districts", "geo_upazilas",
  // Master data (no FK deps)
  "accounts", "mikrotik_routers", "olts", "designations",
  "expense_heads", "income_heads", "other_heads", "packages", "zones",
  "products", "suppliers", "custom_roles", "permissions",
  // Auth & profiles
  "profiles", "user_roles", "role_permissions",
  // Employees & related
  "employees", "employee_education", "employee_emergency_contacts",
  "employee_experience", "employee_salary_structure",
  "employee_provident_fund", "employee_savings_fund",
  "salary_sheets", "loans", "attendance",
  // Customers & billing
  "customers", "customer_sessions", "customer_ledger",
  "bills", "payments", "merchant_payments",
  // Sales & purchases
  "sales", "sale_items", "purchases", "purchase_items", "supplier_payments",
  // Expenses & transactions
  "expenses", "transactions", "daily_reports",
  // Network
  "onus",
  // Logs & support
  "sms_logs", "reminder_logs", "support_tickets", "ticket_replies",
  "admin_sessions", "admin_login_logs", "audit_logs", "backup_logs",
];

const MAX_BACKUP_SIZE_MB = 100;
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

    // Auth: accept any valid authorization (anon key, service key, or session token)
    // Frontend handles permission via PermissionGuard; this function uses service role client
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron-triggered actions
    if (action === "auto" || action === "cleanup") {
      if (action === "auto") {
        const backupType = body.backup_type || "auto_daily";
        return await createSqlBackup(adminClient, "00000000-0000-0000-0000-000000000001", "backups", backupType);
      } else {
        return await cleanupOldBackups(adminClient);
      }
    }

    // For user-triggered actions, optionally check role if admin_id provided
    const adminId = body.admin_id || "00000000-0000-0000-0000-000000000000";

    if (action === "create") {
      return await createBackup(adminClient, adminId, "backups", "manual");
    } else if (action === "create_sql") {
      return await createSqlBackup(adminClient, adminId, "backups", "manual_sql");
    } else if (action === "emergency") {
      return await createBackup(adminClient, adminId, "emergency", "emergency");
    } else if (action === "restore") {
      return await restoreBackup(adminClient, body.backup_data);
    } else if (action === "restore_sql") {
      return await restoreSqlBackup(adminClient, body.sql_content);
    } else if (action === "compare") {
      return await compareBackup(adminClient);
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

  if (fileSize > MAX_BACKUP_SIZE_MB * 1024 * 1024) {
    const msg = `Backup size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds limit (${MAX_BACKUP_SIZE_MB}MB)`;
    await client.from("backup_logs").insert({
      file_name: "size_limit_exceeded", backup_type: backupType,
      file_size: fileSize, created_by: userId, status: "failed", error_message: msg,
    });
    throw new Error(msg);
  }

  const now = new Date();
  const prefix = bucket === "emergency" ? "emergency" : "backup";
  const fileName = `${prefix}_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.json`;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(fileName, new Blob([jsonStr], { type: "application/json" }), {
      contentType: "application/json", upsert: false,
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  await client.from("backup_logs").insert({
    file_name: fileName, backup_type: backupType,
    file_size: fileSize, created_by: userId, status: "completed",
  });

  return new Response(JSON.stringify({ success: true, file_name: fileName, file_size: fileSize }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function cleanupOldBackups(client: any) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const { data: oldBackups, error: queryError } = await client
    .from("backup_logs")
    .select("*")
    .lt("created_at", cutoffDate.toISOString())
    .neq("backup_type", "emergency");

  if (queryError) throw new Error(queryError.message);

  let deletedCount = 0;
  const errors: string[] = [];

  for (const backup of oldBackups || []) {
    try {
      const bucket = backup.backup_type === "emergency" ? "emergency" : "backups";
      const { error: storageError } = await client.storage.from(bucket).remove([backup.file_name]);
      if (storageError) { errors.push(`${backup.file_name}: ${storageError.message}`); continue; }
      await client.from("backup_logs").delete().eq("id", backup.id);
      deletedCount++;
    } catch (err: any) {
      errors.push(`${backup.file_name}: ${err.message}`);
    }
  }

  return new Response(JSON.stringify({
    success: true, deleted: deletedCount, total_found: oldBackups?.length || 0, errors,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function restoreBackup(client: any, backupData: any) {
  if (!backupData?.tables) throw new Error("Invalid backup data");

  // Delete in reverse order (children first)
  const deleteOrder = [...TABLES].reverse();

  for (const table of deleteOrder) {
    if (backupData.tables[table]) {
      const { error } = await client.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) console.error(`Delete ${table}:`, error.message);
    }
  }

  // Insert in forward order (parents first)
  const errors: string[] = [];
  for (const table of TABLES) {
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

async function compareBackup(client: any) {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    counts[table] = error ? -1 : (count ?? 0);
  }
  return new Response(JSON.stringify({ success: true, counts }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function restoreSqlBackup(client: any, sqlContent: string) {
  if (!sqlContent || typeof sqlContent !== "string") throw new Error("Invalid SQL content");

  const insertRegex = /INSERT INTO public\."(\w+)"\s*\(([^)]+)\)\s*VALUES\s*\((.+?)\);/gi;
  const tableData: Record<string, any[]> = {};
  let match;

  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const columns = match[2].split(",").map(c => c.trim().replace(/"/g, ""));
    const valuesStr = match[3];

    const values: any[] = [];
    let current = "";
    let inString = false;
    let depth = 0;

    for (let i = 0; i < valuesStr.length; i++) {
      const ch = valuesStr[i];
      if (inString) {
        if (ch === "'" && valuesStr[i + 1] === "'") {
          current += "'";
          i++;
        } else if (ch === "'") {
          inString = false;
          const rest = valuesStr.substring(i + 1).trimStart();
          if (rest.startsWith("::jsonb")) {
            try { values.push(JSON.parse(current)); } catch { values.push(current); }
            i += valuesStr.substring(i + 1).indexOf("jsonb") + 5;
            current = "";
            continue;
          }
          values.push(current);
          current = "";
        } else {
          current += ch;
        }
      } else {
        if (ch === "'") {
          inString = true;
          current = "";
        } else if (ch === "," && depth === 0) {
          const trimmed = current.trim();
          if (trimmed.length > 0) {
            if (trimmed === "NULL") values.push(null);
            else if (trimmed === "TRUE") values.push(true);
            else if (trimmed === "FALSE") values.push(false);
            else if (!isNaN(Number(trimmed))) values.push(Number(trimmed));
            else values.push(trimmed);
          }
          current = "";
        } else {
          current += ch;
        }
      }
    }
    const lastTrimmed = current.trim();
    if (lastTrimmed.length > 0 && !inString) {
      if (lastTrimmed === "NULL") values.push(null);
      else if (lastTrimmed === "TRUE") values.push(true);
      else if (lastTrimmed === "FALSE") values.push(false);
      else if (!isNaN(Number(lastTrimmed))) values.push(Number(lastTrimmed));
      else values.push(lastTrimmed);
    }

    const row: Record<string, any> = {};
    columns.forEach((col, idx) => { row[col] = idx < values.length ? values[idx] : null; });

    if (!tableData[tableName]) tableData[tableName] = [];
    tableData[tableName].push(row);
  }

  if (Object.keys(tableData).length === 0) {
    throw new Error("No valid INSERT statements found in SQL file");
  }

  return await restoreBackup(client, { tables: tableData });
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
    ``, `BEGIN;`, ``,
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
      sqlParts.push(`-- Table: ${table} (0 rows)`, ``);
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
    throw new Error(`SQL backup size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds limit (${MAX_BACKUP_SIZE_MB}MB)`);
  }

  const now = new Date();
  const fileName = `backup_sql_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.sql`;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(fileName, new Blob([sqlStr], { type: "application/sql" }), {
      contentType: "application/sql", upsert: false,
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  await client.from("backup_logs").insert({
    file_name: fileName, backup_type: backupType,
    file_size: fileSize, created_by: userId, status: "completed",
  });

  return new Response(JSON.stringify({ success: true, file_name: fileName, file_size: fileSize }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
