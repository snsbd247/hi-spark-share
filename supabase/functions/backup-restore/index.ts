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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify auth
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

    // Check super_admin role
    const adminClient = createClient(supabaseUrl, serviceKey);
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

    const { action, file_name, backup_data } = await req.json();

    if (action === "create") {
      return await createBackup(adminClient, userId, "backups", "manual");
    } else if (action === "emergency") {
      return await createBackup(adminClient, userId, "emergency", "emergency");
    } else if (action === "restore") {
      return await restoreBackup(adminClient, backup_data);
    } else if (action === "delete") {
      return await deleteBackup(adminClient, file_name);
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

  const fileSize = new Blob([jsonStr]).size;

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
