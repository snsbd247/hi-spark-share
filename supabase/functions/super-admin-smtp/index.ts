import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function authenticateSuperAdmin(supabase: ReturnType<typeof getSupabaseAdmin>, req: Request) {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) return null;

  const { data: session, error: sessionError } = await supabase
    .from("super_admin_sessions")
    .select("super_admin_id")
    .eq("session_token", token)
    .eq("status", "active")
    .maybeSingle();

  if (sessionError || !session?.super_admin_id) return null;

  const { data: admin, error: adminError } = await supabase
    .from("super_admins")
    .select("id, status")
    .eq("id", session.super_admin_id)
    .maybeSingle();

  if (adminError || !admin || admin.status !== "active") return null;

  return admin;
}

function normalizePayload(body: Record<string, unknown>) {
  return {
    host: String(body.host ?? "").trim(),
    port: Number(body.port) || 587,
    username: String(body.username ?? "").trim(),
    encryption: ["tls", "ssl", "none"].includes(String(body.encryption ?? "").toLowerCase())
      ? String(body.encryption).toLowerCase()
      : "tls",
    from_email: String(body.from_email ?? "").trim(),
    from_name: String(body.from_name ?? "").trim() || "Smart ISP",
    status: String(body.status ?? "active").toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const admin = await authenticateSuperAdmin(supabase, req);

    if (!admin) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // GET - Fetch SMTP settings
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("smtp_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return jsonResponse(data || {});
    }

    // PUT - Save SMTP settings
    if (req.method === "PUT") {
      const body = await req.json();
      const payload = normalizePayload(body);
      const password = String(body.password ?? "");

      if (!payload.host || !payload.username || !payload.from_email || !payload.from_name) {
        return jsonResponse({ error: "Host, username, from email and from name are required" }, 400);
      }

      const { data: existing, error: existingError } = await supabase
        .from("smtp_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const updatePayload: Record<string, unknown> = {
          ...payload,
          updated_at: new Date().toISOString(),
        };

        if (password) {
          updatePayload.password = password;
        }

        const { data, error } = await supabase
          .from("smtp_settings")
          .update(updatePayload)
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) throw error;
        return jsonResponse(data);
      }

      if (!password) {
        return jsonResponse({ error: "Password is required for new SMTP configuration" }, 400);
      }

      const { data, error } = await supabase
        .from("smtp_settings")
        .insert({
          ...payload,
          password,
        })
        .select("*")
        .single();

      if (error) throw error;
      return jsonResponse(data);
    }

    // POST - Send test email via real SMTP
    if (req.method === "POST") {
      const body = await req.json();
      const to = String(body.to ?? "").trim();

      if (!to) {
        return jsonResponse({ error: "Recipient email is required" }, 400);
      }

      // Fetch full SMTP settings including password
      const { data: smtp, error } = await supabase
        .from("smtp_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!smtp?.host || !smtp?.username) {
        return jsonResponse({ error: "SMTP settings are not configured yet" }, 400);
      }

      // Gmail app passwords are displayed with spaces but must be used without them
      const rawPassword = smtp.password || "";
      const smtpPassword = smtp.host?.includes("gmail") ? rawPassword.replace(/\s/g, '') : rawPassword;
      if (!smtpPassword) {
        return jsonResponse({ error: "SMTP password is missing" }, 400);
      }

      const port = Number(smtp.port) || 587;
      const encryption = String(smtp.encryption || "tls").toLowerCase();

      console.log(`[smtp-test] Sending to ${to} via ${smtp.host}:${port} (${encryption})`);

      try {
        // Determine TLS configuration based on encryption and port
        const useTLS = encryption === "tls" || encryption === "ssl" || port === 465;

        const client = new SMTPClient({
          connection: {
            hostname: smtp.host,
            port: port,
            tls: useTLS,
            auth: {
              username: smtp.username,
              password: smtpPassword,
            },
          },
        });

        const fromEmail = smtp.from_email || smtp.username;
        const fromName = smtp.from_name || "Smart ISP";

        await client.send({
          from: `${fromName} <${fromEmail}>`,
          to: to,
          subject: "Smart ISP - SMTP Test Email",
          html: `
            <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;border-radius:10px 10px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:24px;">✅ SMTP Test Successful</h1>
              </div>
              <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
                <p style="color:#374151;font-size:16px;">This is a test email from your <strong>Smart ISP</strong> super admin panel.</p>
                <p style="color:#374151;font-size:16px;">If you received this email, your SMTP configuration is working correctly.</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
                <p style="color:#9ca3af;font-size:12px;">
                  SMTP Host: ${smtp.host}<br>
                  Port: ${port} | Encryption: ${encryption.toUpperCase()}<br>
                  Sent at: ${new Date().toLocaleString()}
                </p>
              </div>
            </div>
          `,
        });

        await client.close();

        console.log(`[smtp-test] Email sent successfully to ${to}`);
        return jsonResponse({ success: true, message: "Test email sent successfully!" });

      } catch (smtpErr: unknown) {
        const errMsg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        console.error(`[smtp-test] SMTP error:`, errMsg);
        return jsonResponse({ 
          success: false, 
          error: `SMTP send failed: ${errMsg}` 
        }, 500);
      }
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("[super-admin-smtp]", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});
