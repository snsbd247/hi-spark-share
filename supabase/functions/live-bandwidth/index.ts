import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── In-Memory Cache (3-second TTL) ─────────────────────────────

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3000; // 3 seconds

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  // Evict old entries
  if (cache.size > 50) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.timestamp > CACHE_TTL_MS * 2) cache.delete(k);
    }
  }
}

// ─── Intelligence Thresholds ────────────────────────────────────

const HEAVY_USER_THRESHOLD_BPS = 50_000_000;  // 50 Mbps total
const IDLE_USER_THRESHOLD_BPS = 10_000;        // 10 Kbps total

// ─── MikroTik Classic API Protocol ──────────────────────────────

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

async function connectWithTimeout(host: string, port: number, timeoutMs = 8000): Promise<Deno.Conn> {
  return await Promise.race([
    Deno.connect({ hostname: host, port, transport: "tcp" }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), timeoutMs)),
  ]);
}

async function connectMikroTik(host: string, port: number, username: string, password: string) {
  const conn = await connectWithTimeout(host, port, 8000);
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

function formatSpeed(bitsPerSec: number): string {
  if (bitsPerSec >= 1_000_000_000) return `${(bitsPerSec / 1_000_000_000).toFixed(2)} Gbps`;
  if (bitsPerSec >= 1_000_000) return `${(bitsPerSec / 1_000_000).toFixed(1)} Mbps`;
  if (bitsPerSec >= 1_000) return `${(bitsPerSec / 1_000).toFixed(0)} Kbps`;
  return `${bitsPerSec} bps`;
}

function parseUptime(uptime: string): number {
  let total = 0;
  const weeks = uptime.match(/(\d+)w/);
  const days = uptime.match(/(\d+)d/);
  const hours = uptime.match(/(\d+)h/);
  const minutes = uptime.match(/(\d+)m/);
  const seconds = uptime.match(/(\d+)s/);
  if (weeks) total += parseInt(weeks[1]) * 604800;
  if (days) total += parseInt(days[1]) * 86400;
  if (hours) total += parseInt(hours[1]) * 3600;
  if (minutes) total += parseInt(minutes[1]) * 60;
  if (seconds) total += parseInt(seconds[1]);
  return total || 1;
}

// ─── Core Data Fetcher ──────────────────────────────────────────

async function fetchLiveBandwidth(
  supabase: any,
  tenantId: string,
  resellerId: string | null,
  routerId: string | null
) {
  // Get routers
  let routersQuery = supabase.from("mikrotik_routers").select("*")
    .eq("status", "active").eq("tenant_id", tenantId);
  if (routerId) routersQuery = routersQuery.eq("id", routerId);
  const { data: routers } = await routersQuery;

  if (!routers || routers.length === 0) {
    return {
      users: [], total_upload: 0, total_download: 0,
      total_upload_formatted: "0 bps", total_download_formatted: "0 bps",
      active_count: 0, heavy_users: 0, idle_users: 0,
      peak_user: null, timestamp: Date.now(),
    };
  }

  // Get customers for PPPoE username matching
  let custQuery = supabase.from("customers").select("id, name, customer_id, pppoe_username, reseller_id, zone_id")
    .eq("tenant_id", tenantId).eq("status", "active");
  if (resellerId) custQuery = custQuery.eq("reseller_id", resellerId);
  const { data: customers } = await custQuery;

  const customerMap = new Map<string, any>();
  if (customers) {
    for (const c of customers) {
      if (c.pppoe_username) customerMap.set(c.pppoe_username, c);
    }
  }

  const allUsers: any[] = [];
  let totalUpload = 0;
  let totalDownload = 0;

  for (const router of routers) {
    try {
      const mt = await connectMikroTik(
        router.ip_address,
        router.api_port || 8728,
        router.username,
        router.password
      );

      try {
        const activeRes = await mt.send(["/ppp/active/print"]);
        const activeUsers = parseItems(activeRes.sentences);

        for (const session of activeUsers) {
          const username = session.name;
          if (!username) continue;

          const customer = customerMap.get(username);
          if (resellerId && !customer) continue;

          const bytesIn = parseInt(session["bytes-in"] || "0", 10);
          const bytesOut = parseInt(session["bytes-out"] || "0", 10);
          const uptime = session.uptime || "0s";
          const address = session.address || "";
          const callerId = session["caller-id"] || "";

          const uptimeSeconds = parseUptime(uptime);
          const uploadBps = uptimeSeconds > 0 ? Math.round((bytesOut * 8) / uptimeSeconds) : 0;
          const downloadBps = uptimeSeconds > 0 ? Math.round((bytesIn * 8) / uptimeSeconds) : 0;
          const totalBps = uploadBps + downloadBps;

          // Intelligence classification
          let status: "normal" | "heavy" | "idle" = "normal";
          if (totalBps >= HEAVY_USER_THRESHOLD_BPS) status = "heavy";
          else if (totalBps <= IDLE_USER_THRESHOLD_BPS) status = "idle";

          totalUpload += uploadBps;
          totalDownload += downloadBps;

          allUsers.push({
            pppoe_username: username,
            customer_name: customer?.name || username,
            customer_id: customer?.customer_id || "",
            db_customer_id: customer?.id || null,
            reseller_id: customer?.reseller_id || null,
            zone_id: customer?.zone_id || null,
            ip_address: address,
            mac_address: callerId,
            upload_bps: uploadBps,
            download_bps: downloadBps,
            total_bps: totalBps,
            upload_mbps: Math.round(uploadBps / 1_000_000 * 100) / 100,
            download_mbps: Math.round(downloadBps / 1_000_000 * 100) / 100,
            total_mbps: Math.round(totalBps / 1_000_000 * 100) / 100,
            upload_formatted: formatSpeed(uploadBps),
            download_formatted: formatSpeed(downloadBps),
            total_formatted: formatSpeed(totalBps),
            uptime,
            bytes_in: bytesIn,
            bytes_out: bytesOut,
            router_name: router.name,
            status,
          });
        }
      } finally {
        mt.close();
      }
    } catch (e) {
      console.error(`Router ${router.name} error:`, e.message);
    }
  }

  // Sort by total speed descending
  allUsers.sort((a, b) => b.total_bps - a.total_bps);

  const heavyUsers = allUsers.filter((u) => u.status === "heavy").length;
  const idleUsers = allUsers.filter((u) => u.status === "idle").length;
  const peakUser = allUsers.length > 0 ? {
    customer_name: allUsers[0].customer_name,
    customer_id: allUsers[0].customer_id,
    total_formatted: allUsers[0].total_formatted,
    total_bps: allUsers[0].total_bps,
  } : null;

  return {
    users: allUsers,
    total_upload: totalUpload,
    total_download: totalDownload,
    total_upload_formatted: formatSpeed(totalUpload),
    total_download_formatted: formatSpeed(totalDownload),
    total_mbps: Math.round((totalUpload + totalDownload) / 1_000_000 * 100) / 100,
    active_count: allUsers.length,
    heavy_users: heavyUsers,
    idle_users: idleUsers,
    peak_user: peakUser,
    timestamp: Date.now(),
  };
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");
    const resellerId = url.searchParams.get("reseller_id");
    const routerId = url.searchParams.get("router_id");

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cache first
    const cacheKey = `${tenantId}:${resellerId || "all"}:${routerId || "all"}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ ...cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const result = await fetchLiveBandwidth(supabase, tenantId, resellerId, routerId);

    // Cache result
    setCache(cacheKey, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Live bandwidth fetch failed", details: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
