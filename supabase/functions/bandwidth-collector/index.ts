import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── MikroTik Classic API Protocol (reused from mikrotik-sync) ──

function encodeLength(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  if (len < 0x4000) return new Uint8Array([((len >> 8) & 0x3f) | 0x80, len & 0xff]);
  if (len < 0x200000) return new Uint8Array([((len >> 16) & 0x1f) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
  if (len < 0x10000000) return new Uint8Array([((len >> 24) & 0x0f) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  return new Uint8Array([0xf0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
}

function encodeWord(word: string): Uint8Array {
  const encoded = new TextEncoder().encode(word);
  const len = encodeLength(encoded.length);
  const result = new Uint8Array(len.length + encoded.length);
  result.set(len);
  result.set(encoded, len.length);
  return result;
}

function encodeSentence(words: string[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const word of words) parts.push(encodeWord(word));
  parts.push(new Uint8Array([0]));
  let totalLen = 0;
  for (const p of parts) totalLen += p.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) { result.set(p, offset); offset += p.length; }
  return result;
}

async function readByte(conn: Deno.Conn, buf: Uint8Array): Promise<number> {
  const n = await conn.read(buf);
  if (n === null || n === 0) throw new Error("Connection closed");
  return buf[0];
}

async function decodeLength(conn: Deno.Conn): Promise<number> {
  const buf = new Uint8Array(1);
  const b = await readByte(conn, buf);
  if ((b & 0x80) === 0) return b;
  if ((b & 0xc0) === 0x80) { const b2 = await readByte(conn, buf); return ((b & 0x3f) << 8) | b2; }
  if ((b & 0xe0) === 0xc0) { const b2 = await readByte(conn, buf); const b3 = await readByte(conn, buf); return ((b & 0x1f) << 16) | (b2 << 8) | b3; }
  if ((b & 0xf0) === 0xe0) { const b2 = await readByte(conn, buf); const b3 = await readByte(conn, buf); const b4 = await readByte(conn, buf); return ((b & 0x0f) << 24) | (b2 << 16) | (b3 << 8) | b4; }
  const b2 = await readByte(conn, buf); const b3 = await readByte(conn, buf); const b4 = await readByte(conn, buf); const b5 = await readByte(conn, buf);
  return (b2 << 24) | (b3 << 16) | (b4 << 8) | b5;
}

async function readWord(conn: Deno.Conn): Promise<string> {
  const len = await decodeLength(conn);
  if (len === 0) return "";
  const data = new Uint8Array(len);
  let read = 0;
  while (read < len) { const n = await conn.read(data.subarray(read)); if (n === null) throw new Error("Connection closed"); read += n; }
  return new TextDecoder().decode(data);
}

async function readSentence(conn: Deno.Conn): Promise<string[]> {
  const words: string[] = [];
  while (true) { const word = await readWord(conn); if (word === "") break; words.push(word); }
  return words;
}

async function readResponse(conn: Deno.Conn): Promise<{ sentences: string[][]; trap?: string }> {
  const sentences: string[][] = [];
  while (true) {
    const sentence = await readSentence(conn);
    if (sentence.length === 0) continue;
    sentences.push(sentence);
    if (sentence[0] === "!done") return { sentences };
    if (sentence[0] === "!trap") {
      const msg = sentence.find((w) => w.startsWith("=message="))?.substring(9) || "Unknown error";
      return { sentences, trap: msg };
    }
  }
}

interface MikroTikConnection {
  conn: Deno.Conn;
  send: (words: string[]) => Promise<{ sentences: string[][]; trap?: string }>;
  close: () => void;
}

async function connectWithTimeout(host: string, port: number, timeoutMs = 10000): Promise<Deno.Conn> {
  return await Promise.race([
    Deno.connect({ hostname: host, port, transport: "tcp" }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Connection timeout`)), timeoutMs)),
  ]);
}

async function connectMikroTik(host: string, port: number, username: string, password: string): Promise<MikroTikConnection> {
  const conn = await connectWithTimeout(host, port, 10000);
  const send = async (words: string[]) => { await conn.write(encodeSentence(words)); return await readResponse(conn); };
  const loginResult = await send(["/login", `=name=${username}`, `=password=${password}`]);
  if (loginResult.trap) { conn.close(); throw new Error(`Login failed: ${loginResult.trap}`); }
  return { conn, send, close: () => { try { conn.close(); } catch { /* ignore */ } } };
}

function parseItems(sentences: string[][]): Record<string, string>[] {
  return sentences.filter((s) => s[0] === "!re").map((s) => {
    const obj: Record<string, string> = {};
    for (const word of s.slice(1)) {
      if (word.startsWith("=")) { const eq = word.indexOf("=", 1); if (eq > 0) obj[word.substring(1, eq)] = word.substring(eq + 1); }
    }
    return obj;
  });
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");

    // Get all active routers for the tenant (or all tenants if no filter)
    let routersQuery = supabase.from("mikrotik_routers").select("*").eq("status", "active");
    if (tenantId) routersQuery = routersQuery.eq("tenant_id", tenantId);
    const { data: routers, error: routerErr } = await routersQuery;
    
    if (routerErr || !routers || routers.length === 0) {
      return new Response(JSON.stringify({ message: "No active routers found", collected: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    let totalCollected = 0;
    let totalErrors = 0;
    const routerResults: any[] = [];

    for (const router of routers) {
      try {
        const mt = await connectMikroTik(
          router.ip_address,
          router.api_port || 8728,
          router.username,
          router.password
        );

        try {
          // Fetch all PPP active connections with traffic stats
          const activeRes = await mt.send(["/ppp/active/print"]);
          const activeUsers = parseItems(activeRes.sentences);

          if (activeUsers.length === 0) {
            routerResults.push({ router: router.name, users: 0, status: "no_active_users" });
            continue;
          }

          // Get PPPoE usernames from active sessions
          const pppoeUsernames = activeUsers
            .map((u) => u.name)
            .filter(Boolean);

          if (pppoeUsernames.length === 0) {
            routerResults.push({ router: router.name, users: 0, status: "no_usernames" });
            continue;
          }

          // Fetch customers matching these PPPoE usernames
          const { data: customers } = await supabase
            .from("customers")
            .select("id, pppoe_username, tenant_id, reseller_id, zone_id")
            .eq("tenant_id", router.tenant_id)
            .in("pppoe_username", pppoeUsernames);

          if (!customers || customers.length === 0) {
            routerResults.push({ router: router.name, users: activeUsers.length, status: "no_matching_customers" });
            continue;
          }

          // Build username → customer map
          const customerMap = new Map<string, any>();
          for (const c of customers) {
            if (c.pppoe_username) customerMap.set(c.pppoe_username, c);
          }

          // Collect bandwidth data from active users
          // MikroTik /ppp/active returns: bytes-in, bytes-out (as strings)
          const upserts: any[] = [];
          for (const session of activeUsers) {
            const customer = customerMap.get(session.name);
            if (!customer) continue;

            // bytes-in = download (from customer perspective), bytes-out = upload
            const bytesIn = parseInt(session["bytes-in"] || "0", 10);
            const bytesOut = parseInt(session["bytes-out"] || "0", 10);
            const downloadMb = Math.round((bytesIn / 1048576) * 100) / 100;
            const uploadMb = Math.round((bytesOut / 1048576) * 100) / 100;
            const totalMb = Math.round((downloadMb + uploadMb) * 100) / 100;

            upserts.push({
              customer_id: customer.id,
              tenant_id: customer.tenant_id,
              reseller_id: customer.reseller_id,
              zone_id: customer.zone_id,
              upload_mb: uploadMb,
              download_mb: downloadMb,
              total_mb: totalMb,
              date: today,
            });
          }

          if (upserts.length > 0) {
            // Upsert: on conflict (customer_id, date) → accumulate values
            // Since we can't do raw SQL upsert with increment, we'll fetch existing and merge
            const customerIds = upserts.map((u) => u.customer_id);
            const { data: existing } = await supabase
              .from("customer_bandwidth_usages")
              .select("id, customer_id, upload_mb, download_mb, total_mb")
              .in("customer_id", customerIds)
              .eq("date", today);

            const existingMap = new Map<string, any>();
            if (existing) {
              for (const e of existing) existingMap.set(e.customer_id, e);
            }

            const inserts: any[] = [];
            const updates: { id: string; upload_mb: number; download_mb: number; total_mb: number }[] = [];

            for (const u of upserts) {
              const ex = existingMap.get(u.customer_id);
              if (ex) {
                // Take the max of existing and new (since MikroTik active bytes reset on reconnect)
                const newUpload = Math.max(u.upload_mb, parseFloat(ex.upload_mb));
                const newDownload = Math.max(u.download_mb, parseFloat(ex.download_mb));
                updates.push({
                  id: ex.id,
                  upload_mb: newUpload,
                  download_mb: newDownload,
                  total_mb: Math.round((newUpload + newDownload) * 100) / 100,
                });
              } else {
                inserts.push(u);
              }
            }

            if (inserts.length > 0) {
              await supabase.from("customer_bandwidth_usages").insert(inserts);
            }
            for (const up of updates) {
              await supabase
                .from("customer_bandwidth_usages")
                .update({ upload_mb: up.upload_mb, download_mb: up.download_mb, total_mb: up.total_mb, updated_at: new Date().toISOString() })
                .eq("id", up.id);
            }

            totalCollected += upserts.length;
          }

          routerResults.push({ router: router.name, users: activeUsers.length, matched: upserts.length, status: "ok" });
        } finally {
          mt.close();
        }
      } catch (e) {
        totalErrors++;
        routerResults.push({ router: router.name, status: "error", error: e.message });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Bandwidth collection complete`,
        date: today,
        routers_processed: routers.length,
        total_collected: totalCollected,
        total_errors: totalErrors,
        details: routerResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Bandwidth collection failed", details: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
