import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── MikroTik Classic API Protocol (TCP port 8728) ──────────────

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
  while (read < len) { const n = await conn.read(data.subarray(read)); if (n === null) throw new Error("Connection closed while reading word"); read += n; }
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
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs / 1000}s - ensure MikroTik API port ${port} is open and accessible from the internet`)), timeoutMs)),
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

// ─── Supabase helpers ───────────────────────────────────────────

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function getRouterById(supabase: any, routerId: string) {
  const { data, error } = await supabase.from("mikrotik_routers").select("*").eq("id", routerId).single();
  if (error || !data) return null;
  return data;
}

function getEnvRouter() {
  return {
    ip_address: Deno.env.get("MIKROTIK_HOST")!,
    username: Deno.env.get("MIKROTIK_USERNAME")!,
    password: Deno.env.get("MIKROTIK_PASSWORD")!,
    api_port: 8728,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "Unknown error";
}

function isRouterConnectivityError(message: string) {
  return /connection refused|timeout|timed out|network is unreachable|no route to host|connection closed|os error 111/i.test(message);
}

function normalizeApiPort(port: unknown) {
  const numericPort = Number(port);
  return Number.isFinite(numericPort) && numericPort > 0 ? numericPort : 8728;
}

function getProvidedRouter(body: any) {
  if (!body?.ip_address || !body?.username || !body?.password) {
    return null;
  }

  return {
    id: body.router_id || "provided-router",
    name: body.name || "Selected Router",
    ip_address: body.ip_address,
    username: body.username,
    password: body.password,
    api_port: normalizeApiPort(body.api_port),
  };
}

async function withRouter(router: { ip_address: string; username: string; password: string; api_port: number }, fn: (mt: MikroTikConnection) => Promise<any>) {
  const mt = await connectMikroTik(router.ip_address, router.api_port || 8728, router.username, router.password);
  try { return await fn(mt); } finally { mt.close(); }
}

async function getRouterConfig(supabase: any, routerId?: string) {
  if (routerId) {
    const router = await getRouterById(supabase, routerId);
    if (router) return router;
  }
  return getEnvRouter();
}

// Helper to update customer sync status
async function updateSyncStatus(supabase: any, customerId: string, status: string) {
  await supabase.from("customers").update({ mikrotik_sync_status: status }).eq("id", customerId);
}

// Helper: ensure a PPP profile exists on the router, create if missing
async function ensureProfileExists(mt: MikroTikConnection, profileName: string) {
  if (!profileName || profileName === "default") return;
  try {
    const listRes = await mt.send(["/ppp/profile/print", `?name=${profileName}`]);
    const existing = parseItems(listRes.sentences);
    if (existing.length === 0) {
      console.log(`Auto-creating missing PPP profile: ${profileName}`);
      await mt.send(["/ppp/profile/add", `=name=${profileName}`, "=local-address=10.10.10.1"]);
    }
  } catch (e) {
    console.error(`Failed to ensure profile ${profileName}:`, e.message);
  }
}

// ─── Edge Function Handler ──────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // ─── TEST CONNECTION ────────────────────────────────────────
    if (req.method === "POST" && path === "test-connection") {
      const { ip_address, username, password, api_port } = await req.json();
      if (!ip_address || !username || !password) {
        return jsonResponse({ success: false, error: "Missing router credentials" }, 400);
      }
      try {
        const result = await withRouter({ ip_address, username, password, api_port: api_port || 8728 }, async (mt) => {
          const identityRes = await mt.send(["/system/identity/print"]);
          const resourceRes = await mt.send(["/system/resource/print"]);
          const identity = parseItems(identityRes.sentences);
          const resource = parseItems(resourceRes.sentences);
          return { identity: identity[0]?.name || "Unknown", version: resource[0]?.version || "Unknown", uptime: resource[0]?.uptime || "Unknown" };
        });
        return jsonResponse({ success: true, ...result });
      } catch (e) {
        const message = getErrorMessage(e);
        return jsonResponse({
          success: false,
          error: message,
          error_type: isRouterConnectivityError(message) ? "router_unreachable" : "connection_failed",
        });
      }
    }

    // ─── CREATE PPPOE USER ──────────────────────────────────────
    if (req.method === "POST" && path === "create-pppoe") {
      const { customer_id, pppoe_username, pppoe_password, profile_name, comment, router_id } = await req.json();
      if (!pppoe_username || !pppoe_password) {
        return new Response(JSON.stringify({ error: "Missing PPPoE credentials" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabase = getSupabaseAdmin();
      const routerConfig = await getRouterConfig(supabase, router_id);

      try {
        await withRouter(routerConfig, async (mt) => {
          // Ensure profile exists before assigning
          await ensureProfileExists(mt, profile_name || "default");
          const listRes = await mt.send(["/ppp/secret/print", `?name=${pppoe_username}`]);
          const existing = parseItems(listRes.sentences);
          if (existing.length > 0) {
            const words = ["/ppp/secret/set", `=.id=${existing[0][".id"]}`, `=password=${pppoe_password}`, `=profile=${profile_name || "default"}`];
            if (comment) words.push(`=comment=${comment}`);
            const res = await mt.send(words);
            if (res.trap) throw new Error(res.trap);
          } else {
            const words = ["/ppp/secret/add", `=name=${pppoe_username}`, `=password=${pppoe_password}`, `=service=pppoe`, `=profile=${profile_name || "default"}`];
            if (comment) words.push(`=comment=${comment}`);
            const res = await mt.send(words);
            if (res.trap) throw new Error(res.trap);
          }
        });

        if (customer_id) {
          await supabase.from("customers").update({ connection_status: "active", mikrotik_sync_status: "synced" }).eq("id", customer_id);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("PPPoE create failed:", e.message);
        if (customer_id) await updateSyncStatus(supabase, customer_id, "failed");
        return new Response(JSON.stringify({ error: "MikroTik PPPoE creation failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── UPDATE PPPOE USER ──────────────────────────────────────
    if (req.method === "POST" && path === "update-pppoe") {
      const { customer_id, pppoe_username, pppoe_password, profile_name, old_pppoe_username, router_id } = await req.json();
      if (!pppoe_username) {
        return new Response(JSON.stringify({ error: "Missing PPPoE username" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabase = getSupabaseAdmin();
      const routerConfig = await getRouterConfig(supabase, router_id);

      try {
        await withRouter(routerConfig, async (mt) => {
          // Ensure profile exists before assigning
          if (profile_name) await ensureProfileExists(mt, profile_name);
          // Find by old username if renamed, else current
          const searchName = old_pppoe_username || pppoe_username;
          const listRes = await mt.send(["/ppp/secret/print", `?name=${searchName}`]);
          const existing = parseItems(listRes.sentences);

          if (existing.length > 0) {
            const words = ["/ppp/secret/set", `=.id=${existing[0][".id"]}`];
            if (old_pppoe_username && old_pppoe_username !== pppoe_username) words.push(`=name=${pppoe_username}`);
            if (pppoe_password) words.push(`=password=${pppoe_password}`);
            if (profile_name) words.push(`=profile=${profile_name}`);
            const res = await mt.send(words);
            if (res.trap) throw new Error(res.trap);
          } else {
            // Secret doesn't exist, create it
            const words = ["/ppp/secret/add", `=name=${pppoe_username}`, `=service=pppoe`];
            if (pppoe_password) words.push(`=password=${pppoe_password}`);
            if (profile_name) words.push(`=profile=${profile_name}`);
            const res = await mt.send(words);
            if (res.trap) throw new Error(res.trap);
          }
        });

        if (customer_id) await updateSyncStatus(supabase, customer_id, "synced");
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("PPPoE update failed:", e.message);
        if (customer_id) await updateSyncStatus(supabase, customer_id, "failed");
        return new Response(JSON.stringify({ error: "MikroTik PPPoE update failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── DISABLE PPPOE USER ─────────────────────────────────────
    if (req.method === "POST" && path === "disable-pppoe") {
      const { pppoe_username, router_id, customer_id } = await req.json();
      if (!pppoe_username) {
        return new Response(JSON.stringify({ error: "Missing pppoe_username" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabase = getSupabaseAdmin();
      const routerConfig = await getRouterConfig(supabase, router_id);

      try {
        await withRouter(routerConfig, async (mt) => {
          const listRes = await mt.send(["/ppp/secret/print", `?name=${pppoe_username}`]);
          const existing = parseItems(listRes.sentences);
          if (existing.length > 0) {
            await mt.send(["/ppp/secret/set", `=.id=${existing[0][".id"]}`, "=disabled=yes"]);
            try {
              const activeRes = await mt.send(["/ppp/active/print", `?name=${pppoe_username}`]);
              const sessions = parseItems(activeRes.sentences);
              for (const session of sessions) await mt.send(["/ppp/active/remove", `=.id=${session[".id"]}`]);
            } catch { /* ignore session disconnect errors */ }
          }
        });

        if (customer_id) {
          await supabase.from("customers").update({ connection_status: "suspended", status: "suspended", mikrotik_sync_status: "synced" }).eq("id", customer_id);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("PPPoE disable failed:", e.message);
        if (customer_id) await updateSyncStatus(supabase, customer_id, "failed");
        return new Response(JSON.stringify({ error: "MikroTik disable failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── ENABLE PPPOE USER ──────────────────────────────────────
    if (req.method === "POST" && path === "enable-pppoe") {
      const { pppoe_username, router_id, customer_id } = await req.json();
      if (!pppoe_username) {
        return new Response(JSON.stringify({ error: "Missing pppoe_username" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabase = getSupabaseAdmin();
      const routerConfig = await getRouterConfig(supabase, router_id);

      try {
        await withRouter(routerConfig, async (mt) => {
          const listRes = await mt.send(["/ppp/secret/print", `?name=${pppoe_username}`]);
          const existing = parseItems(listRes.sentences);
          if (existing.length > 0) await mt.send(["/ppp/secret/set", `=.id=${existing[0][".id"]}`, "=disabled=no"]);
        });

        if (customer_id) {
          await supabase.from("customers").update({ connection_status: "active", status: "active", mikrotik_sync_status: "synced" }).eq("id", customer_id);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("PPPoE enable failed:", e.message);
        if (customer_id) await updateSyncStatus(supabase, customer_id, "failed");
        return new Response(JSON.stringify({ error: "MikroTik enable failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── REMOVE PPPOE USER ──────────────────────────────────────
    if (req.method === "POST" && path === "remove-pppoe") {
      const { pppoe_username, router_id, customer_id } = await req.json();
      if (!pppoe_username) {
        return new Response(JSON.stringify({ error: "Missing pppoe_username" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabase = getSupabaseAdmin();
      const routerConfig = await getRouterConfig(supabase, router_id);

      try {
        await withRouter(routerConfig, async (mt) => {
          // Disconnect active session first
          try {
            const activeRes = await mt.send(["/ppp/active/print", `?name=${pppoe_username}`]);
            const sessions = parseItems(activeRes.sentences);
            for (const session of sessions) await mt.send(["/ppp/active/remove", `=.id=${session[".id"]}`]);
          } catch { /* ignore */ }
          // Remove secret
          const listRes = await mt.send(["/ppp/secret/print", `?name=${pppoe_username}`]);
          const existing = parseItems(listRes.sentences);
          if (existing.length > 0) {
            const res = await mt.send(["/ppp/secret/remove", `=.id=${existing[0][".id"]}`]);
            if (res.trap) throw new Error(res.trap);
          }
        });

        if (customer_id) await updateSyncStatus(supabase, customer_id, "pending");
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("PPPoE remove failed:", e.message);
        return new Response(JSON.stringify({ error: "MikroTik remove failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── SYNC PROFILE (Package → PPP Profile) ──────────────────
    if (req.method === "POST" && path === "sync-profile") {
      const { package_id, router_id } = await req.json();
      if (!package_id) {
        return new Response(JSON.stringify({ error: "Missing package_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabase = getSupabaseAdmin();
      const { data: pkg, error } = await supabase.from("packages").select("*").eq("id", package_id).single();
      if (error || !pkg) {
        return new Response(JSON.stringify({ error: "Package not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Use router_id from request, then from package, then env
      const routerConfig = await getRouterConfig(supabase, router_id || pkg.router_id);
      const profileName = pkg.mikrotik_profile_name || `ISP-${pkg.name.replace(/\s+/g, "-")}`;
      const rateLimit = `${pkg.upload_speed}M/${pkg.download_speed}M`;

      try {
        await withRouter(routerConfig, async (mt) => {
          const listRes = await mt.send(["/ppp/profile/print", `?name=${profileName}`]);
          const existing = parseItems(listRes.sentences);
          if (existing.length > 0) {
            const res = await mt.send(["/ppp/profile/set", `=.id=${existing[0][".id"]}`, `=rate-limit=${rateLimit}`]);
            if (res.trap) throw new Error(res.trap);
          } else {
            const res = await mt.send(["/ppp/profile/add", `=name=${profileName}`, `=rate-limit=${rateLimit}`, "=local-address=10.10.10.1"]);
            if (res.trap) throw new Error(res.trap);
          }
        });

        await supabase.from("packages").update({ mikrotik_profile_name: profileName, router_id: router_id || pkg.router_id || null }).eq("id", package_id);
        return new Response(JSON.stringify({ success: true, profile_name: profileName }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("PPP profile sync failed:", e.message);
        return new Response(JSON.stringify({ error: "MikroTik profile sync failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── REMOVE PROFILE ─────────────────────────────────────────
    if (req.method === "POST" && path === "remove-profile") {
      const { package_id, router_id, profile_name } = await req.json();

      const supabase = getSupabaseAdmin();
      let pName = profile_name;
      if (!pName && package_id) {
        const { data: pkg } = await supabase.from("packages").select("mikrotik_profile_name").eq("id", package_id).single();
        pName = pkg?.mikrotik_profile_name;
      }
      if (!pName) {
        return new Response(JSON.stringify({ error: "No profile name" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (pName === "default") {
        return new Response(JSON.stringify({ success: true, message: "Skipped default profile" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const routerConfig = await getRouterConfig(supabase, router_id);

      try {
        await withRouter(routerConfig, async (mt) => {
          const listRes = await mt.send(["/ppp/profile/print", `?name=${pName}`]);
          const existing = parseItems(listRes.sentences);
          if (existing.length > 0) {
            const res = await mt.send(["/ppp/profile/remove", `=.id=${existing[0][".id"]}`]);
            if (res.trap) throw new Error(res.trap);
          }
        });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("PPP profile remove failed:", e.message);
        return new Response(JSON.stringify({ error: "MikroTik profile remove failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── RETRY SYNC (for failed customers) ──────────────────────
    if (req.method === "POST" && path === "retry-sync") {
      const { customer_id } = await req.json();
      if (!customer_id) {
        return new Response(JSON.stringify({ error: "Missing customer_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabase = getSupabaseAdmin();
      const { data: customer } = await supabase.from("customers").select("*, packages(mikrotik_profile_name, name)").eq("id", customer_id).single();

      if (!customer || !customer.pppoe_username) {
        return new Response(JSON.stringify({ error: "Customer or PPPoE credentials not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const routerConfig = await getRouterConfig(supabase, customer.router_id);
      const profileName = customer.packages?.mikrotik_profile_name || customer.packages?.name || "default";

      try {
        await withRouter(routerConfig, async (mt) => {
          const listRes = await mt.send(["/ppp/secret/print", `?name=${customer.pppoe_username}`]);
          const existing = parseItems(listRes.sentences);
          if (existing.length > 0) {
            const words = ["/ppp/secret/set", `=.id=${existing[0][".id"]}`, `=password=${customer.pppoe_password || ""}`, `=profile=${profileName}`];
            if (customer.status === "suspended" || customer.connection_status === "suspended") words.push("=disabled=yes");
            else words.push("=disabled=no");
            words.push(`=comment=${customer.customer_id} - ${customer.name}`);
            const res = await mt.send(words);
            if (res.trap) throw new Error(res.trap);
          } else {
            const words = ["/ppp/secret/add", `=name=${customer.pppoe_username}`, `=password=${customer.pppoe_password || ""}`, `=service=pppoe`, `=profile=${profileName}`, `=comment=${customer.customer_id} - ${customer.name}`];
            if (customer.status === "suspended" || customer.connection_status === "suspended") words.push("=disabled=yes");
            const res = await mt.send(words);
            if (res.trap) throw new Error(res.trap);
          }
        });

        await updateSyncStatus(supabase, customer_id, "synced");
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("Retry sync failed:", e.message);
        await updateSyncStatus(supabase, customer_id, "failed");
        return new Response(JSON.stringify({ error: "Retry sync failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── BILL CONTROL: Suspend overdue, reactivate paid ─────────
    if (req.method === "POST" && path === "bill-control") {
      const supabase = getSupabaseAdmin();
      const results = { suspended: 0, reactivated: 0, errors: [] as string[] };
      const today = new Date().toISOString().split("T")[0];

      const { data: overdueBills } = await supabase
        .from("bills")
        .select("*, customers!inner(id, pppoe_username, router_id, connection_status, status)")
        .eq("status", "unpaid")
        .lt("due_date", today);

      if (overdueBills) {
        for (const bill of overdueBills) {
          const cust = bill.customers;
          if (!cust || cust.connection_status === "suspended" || !cust.pppoe_username) continue;
          try {
            const routerConfig = await getRouterConfig(supabase, cust.router_id);
            await withRouter(routerConfig, async (mt) => {
              const listRes = await mt.send(["/ppp/secret/print", `?name=${cust.pppoe_username}`]);
              const existing = parseItems(listRes.sentences);
              if (existing.length > 0) {
                await mt.send(["/ppp/secret/set", `=.id=${existing[0][".id"]}`, "=disabled=yes"]);
                try {
                  const activeRes = await mt.send(["/ppp/active/print", `?name=${cust.pppoe_username}`]);
                  const sessions = parseItems(activeRes.sentences);
                  for (const session of sessions) await mt.send(["/ppp/active/remove", `=.id=${session[".id"]}`]);
                } catch { /* ignore */ }
              }
            });
            await supabase.from("customers").update({ connection_status: "suspended", status: "suspended", mikrotik_sync_status: "synced" }).eq("id", cust.id);
            results.suspended++;
          } catch (e) {
            console.error(`Failed to suspend ${cust.id}:`, e.message);
            await updateSyncStatus(supabase, cust.id, "failed");
            results.errors.push(`Suspend ${cust.id}: ${e.message}`);
          }
        }
      }

      const { data: reactivateCandidates } = await supabase
        .from("customers")
        .select("id, pppoe_username, router_id, connection_status")
        .in("connection_status", ["suspended", "pending_reactivation"])
        .not("pppoe_username", "is", null);

      if (reactivateCandidates) {
        for (const cust of reactivateCandidates) {
          if (cust.connection_status === "suspended") {
            const { data: unpaidBills } = await supabase.from("bills").select("id").eq("customer_id", cust.id).eq("status", "unpaid").lt("due_date", today).limit(1);
            if (unpaidBills && unpaidBills.length > 0) continue;
          }
          try {
            const routerConfig = await getRouterConfig(supabase, cust.router_id);
            await withRouter(routerConfig, async (mt) => {
              const listRes = await mt.send(["/ppp/secret/print", `?name=${cust.pppoe_username}`]);
              const existing = parseItems(listRes.sentences);
              if (existing.length > 0) await mt.send(["/ppp/secret/set", `=.id=${existing[0][".id"]}`, "=disabled=no"]);
            });
            await supabase.from("customers").update({ connection_status: "active", status: "active", mikrotik_sync_status: "synced" }).eq("id", cust.id);
            results.reactivated++;
          } catch (e) {
            console.error(`Failed to reactivate ${cust.id}:`, e.message);
            await updateSyncStatus(supabase, cust.id, "failed");
            results.errors.push(`Reactivate ${cust.id}: ${e.message}`);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── SYNC CUSTOMER (Queue) ──────────────────────────────────
    if (req.method === "POST" && path === "sync-customer") {
      const { customer_id } = await req.json();
      const supabase = getSupabaseAdmin();
      const { data: customer } = await supabase.from("customers").select("*, packages(download_speed, upload_speed, mikrotik_profile_name)").eq("id", customer_id).single();

      if (!customer || !customer.ip_address || !customer.packages) {
        return new Response(JSON.stringify({ error: "Customer, IP, or package not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const routerConfig = await getRouterConfig(supabase, customer.router_id);
      const pkg = customer.packages;
      const maxLimit = `${pkg.upload_speed}M/${pkg.download_speed}M`;

      try {
        await withRouter(routerConfig, async (mt) => {
          const listRes = await mt.send(["/queue/simple/print", `?target=${customer.ip_address}/32`]);
          const existing = parseItems(listRes.sentences);
          if (existing.length > 0) {
            await mt.send(["/queue/simple/set", `=.id=${existing[0][".id"]}`, `=max-limit=${maxLimit}`]);
          } else {
            await mt.send(["/queue/simple/add", `=name=${customer.customer_id}`, `=target=${customer.ip_address}/32`, `=max-limit=${maxLimit}`]);
          }
        });
        await updateSyncStatus(supabase, customer_id, "synced");
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        await updateSyncStatus(supabase, customer_id, "failed");
        return new Response(JSON.stringify({ error: "MikroTik sync failed", details: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── BULK SYNC ALL CUSTOMERS ───────────────────────────────
    if (req.method === "POST" && path === "bulk-sync-customers") {
      const supabase = getSupabaseAdmin();
      const { data: customers } = await supabase
        .from("customers")
        .select("*, packages(mikrotik_profile_name, name)")
        .not("pppoe_username", "is", null)
        .not("router_id", "is", null);

      if (!customers || customers.length === 0) {
        return new Response(JSON.stringify({ success: true, results: { synced: 0, failed: 0, errors: [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const results = { synced: 0, failed: 0, errors: [] as string[] };

      // Group customers by router_id
      const byRouter: Record<string, any[]> = {};
      for (const c of customers) {
        const rid = c.router_id || "env";
        if (!byRouter[rid]) byRouter[rid] = [];
        byRouter[rid].push(c);
      }

      for (const [routerId, custs] of Object.entries(byRouter)) {
        try {
          const routerConfig = await getRouterConfig(supabase, routerId === "env" ? undefined : routerId);
          await withRouter(routerConfig, async (mt) => {
            for (const cust of custs) {
              try {
                const profileName = cust.packages?.mikrotik_profile_name || cust.packages?.name || "default";
                await ensureProfileExists(mt, profileName);

                const listRes = await mt.send(["/ppp/secret/print", `?name=${cust.pppoe_username}`]);
                const existing = parseItems(listRes.sentences);
                if (existing.length > 0) {
                  const words = ["/ppp/secret/set", `=.id=${existing[0][".id"]}`, `=profile=${profileName}`, `=comment=${cust.customer_id} - ${cust.name}`];
                  if (cust.pppoe_password) words.push(`=password=${cust.pppoe_password}`);
                  if (cust.status === "suspended" || cust.connection_status === "suspended") words.push("=disabled=yes");
                  else words.push("=disabled=no");
                  await mt.send(words);
                } else {
                  const words = ["/ppp/secret/add", `=name=${cust.pppoe_username}`, `=service=pppoe`, `=profile=${profileName}`, `=comment=${cust.customer_id} - ${cust.name}`];
                  if (cust.pppoe_password) words.push(`=password=${cust.pppoe_password}`);
                  if (cust.status === "suspended" || cust.connection_status === "suspended") words.push("=disabled=yes");
                  await mt.send(words);
                }
                await updateSyncStatus(supabase, cust.id, "synced");
                results.synced++;
              } catch (e) {
                console.error(`Bulk sync failed for ${cust.customer_id}:`, e.message);
                await updateSyncStatus(supabase, cust.id, "failed");
                results.failed++;
                results.errors.push(`${cust.customer_id}: ${e.message}`);
              }
            }
          });
        } catch (e) {
          console.error(`Router connection failed for ${routerId}:`, e.message);
          for (const cust of custs) {
            await updateSyncStatus(supabase, cust.id, "failed");
            results.failed++;
          }
          results.errors.push(`Router ${routerId}: ${e.message}`);
        }
      }

      return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── BULK SYNC ALL PACKAGES ─────────────────────────────────
    if (req.method === "POST" && path === "bulk-sync-packages") {
      const body = await req.json().catch(() => ({}));
      const requestedRouterId = body?.router_id || null;
      const providedRouter = getProvidedRouter(body);
      const supabase = getSupabaseAdmin();
      const { data: packages } = await supabase
        .from("packages")
        .select("*")
        .eq("is_active", true);

      let routers = providedRouter ? [providedRouter] : null;
      if (!routers) {
        let routersQuery = supabase.from("mikrotik_routers").select("*").eq("status", "active");
        if (requestedRouterId) {
          routersQuery = routersQuery.eq("id", requestedRouterId);
        }

        const { data } = await routersQuery;
        routers = data;

        if (requestedRouterId && !routers?.length) {
          return jsonResponse({
            success: false,
            error: "Selected router not found or inactive",
            results: { synced: 0, imported: 0, failed: 0, errors: [] },
          });
        }
      }

      const candidatePackages = requestedRouterId
        ? (packages || []).filter((pkg: any) => !pkg.router_id || pkg.router_id === requestedRouterId)
        : (packages || []);

      const results = { synced: 0, imported: 0, failed: 0, errors: [] as string[] };

      // Get all active routers
      const allRouters = routers?.length ? routers : [{ ...getEnvRouter(), id: "env-default", name: "Default Router" }];

      // Build a set of existing mikrotik_profile_names for dedup
      const existingProfileNames = new Set(candidatePackages.map((p: any) => p.mikrotik_profile_name).filter(Boolean));

      // Step 1: Push existing DB packages to MikroTik
      const byRouter: Record<string, any[]> = {};
      const defaultRouterKey = requestedRouterId || (providedRouter ? "provided-router" : "env");
      for (const pkg of candidatePackages.filter((p: any) => p.download_speed > 0 || p.upload_speed > 0)) {
        const rid = requestedRouterId || pkg.router_id || defaultRouterKey;
        if (!byRouter[rid]) byRouter[rid] = [];
        byRouter[rid].push(pkg);
      }

      for (const [routerId, pkgs] of Object.entries(byRouter)) {
        try {
          const routerConfig = providedRouter && (routerId === requestedRouterId || routerId === "provided-router" || (!requestedRouterId && routerId === "env"))
            ? providedRouter
            : await getRouterConfig(supabase, routerId === "env" ? undefined : routerId);
          await withRouter(routerConfig, async (mt) => {
            for (const pkg of pkgs) {
              try {
                const profileName = pkg.mikrotik_profile_name || `ISP-${pkg.name.replace(/\s+/g, "-")}`;
                const rateLimit = `${pkg.upload_speed}M/${pkg.download_speed}M`;

                const listRes = await mt.send(["/ppp/profile/print", `?name=${profileName}`]);
                const existing = parseItems(listRes.sentences);
                if (existing.length > 0) {
                  await mt.send(["/ppp/profile/set", `=.id=${existing[0][".id"]}`, `=rate-limit=${rateLimit}`]);
                } else {
                  await mt.send(["/ppp/profile/add", `=name=${profileName}`, `=rate-limit=${rateLimit}`, "=local-address=10.10.10.1"]);
                }
                await supabase.from("packages").update({ mikrotik_profile_name: profileName }).eq("id", pkg.id);
                existingProfileNames.add(profileName);
                results.synced++;
              } catch (e) {
                console.error(`Bulk profile sync failed for ${pkg.name}:`, e.message);
                results.failed++;
                results.errors.push(`${pkg.name}: ${e.message}`);
              }
            }
          });
        } catch (e) {
          console.error(`Router connection failed for ${routerId}:`, e.message);
          results.failed += pkgs.length;
          results.errors.push(`Router ${routerId}: ${e.message}`);
        }
      }

      // Step 2: Import PPP profiles FROM MikroTik that don't exist in DB
      for (const router of allRouters) {
        const routerConfig = { ip_address: router.ip_address, username: router.username, password: router.password, api_port: router.api_port || 8728 };
        const routerId = router.id !== "env-default" ? router.id : null;
        try {
          await withRouter(routerConfig, async (mt) => {
            const profileRes = await mt.send(["/ppp/profile/print"]);
            const mkProfiles = parseItems(profileRes.sentences);

            for (const profile of mkProfiles) {
              const pName = profile.name;
              if (!pName || pName === "default" || existingProfileNames.has(pName)) continue;

              try {
                // Parse rate-limit (format: "uploadM/downloadM" or "upload/download")
                let downloadSpeed = 0;
                let uploadSpeed = 0;
                const rateLimit = profile["rate-limit"] || "";
                if (rateLimit) {
                  const parts = rateLimit.split("/");
                  if (parts.length >= 2) {
                    uploadSpeed = parseInt(parts[0]) || 0;
                    downloadSpeed = parseInt(parts[1]) || 0;
                    // Convert from bps to Mbps if needed (values > 1000 likely in kbps or bps)
                    if (uploadSpeed > 1000) uploadSpeed = Math.round(uploadSpeed / 1000000);
                    if (downloadSpeed > 1000) downloadSpeed = Math.round(downloadSpeed / 1000000);
                  }
                }

                const speedLabel = downloadSpeed > 0 ? `${downloadSpeed} Mbps` : pName;

                const { error: insertErr } = await supabase.from("packages").insert({
                  name: pName,
                  speed: speedLabel,
                  monthly_price: 0,
                  download_speed: downloadSpeed,
                  upload_speed: uploadSpeed,
                  mikrotik_profile_name: pName,
                  router_id: routerId,
                  is_active: true,
                });

                if (insertErr) {
                  if (insertErr.message?.includes("duplicate")) continue;
                  throw new Error(insertErr.message);
                }

                existingProfileNames.add(pName);
                results.imported++;
              } catch (e) {
                console.error(`Import profile ${pName} failed:`, e.message);
                results.failed++;
                results.errors.push(`Import ${pName}: ${e.message}`);
              }
            }
          });
        } catch (e) {
          console.error(`Router connection failed for import:`, e.message);
          results.errors.push(`Import from ${router.name || router.ip_address}: ${e.message}`);
        }
      }

      return jsonResponse({ success: true, results });
    }

    // ─── ROUTER STATS (Online + Suspended from all routers) ────
    if (req.method === "POST" && path === "router-stats") {
      const supabase = getSupabaseAdmin();
      const { data: routers } = await supabase
        .from("mikrotik_routers")
        .select("*")
        .eq("status", "active");

      let totalOnline = 0;
      let totalSuspended = 0;
      const routerDetails: { name: string; online: number; suspended: number; error?: string }[] = [];

      if (routers && routers.length > 0) {
        for (const router of routers) {
          try {
            const stats = await withRouter(router, async (mt) => {
              // Count active PPPoE sessions
              const activeRes = await mt.send(["/ppp/active/print"]);
              const activeUsers = parseItems(activeRes.sentences);

              // Count disabled PPP secrets
              const secretRes = await mt.send(["/ppp/secret/print", "?disabled=yes"]);
              const disabledSecrets = parseItems(secretRes.sentences);

              return { online: activeUsers.length, suspended: disabledSecrets.length };
            });
            totalOnline += stats.online;
            totalSuspended += stats.suspended;
            routerDetails.push({ name: router.name, online: stats.online, suspended: stats.suspended });
          } catch (e) {
            console.error(`Router stats failed for ${router.name} (${router.ip_address}):`, e.message);
            routerDetails.push({ name: router.name, online: 0, suspended: 0, error: e.message });
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        total_online: totalOnline,
        total_suspended: totalSuspended,
        routers: routerDetails,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── SYNC ALL (BI-DIRECTIONAL) ─────────────────────────────
    if (req.method === "POST" && path === "sync-all") {
      const body = await req.json().catch(() => ({}));
      const requestedRouterId = body?.router_id || null;
      const providedRouter = getProvidedRouter(body);
      const supabase = getSupabaseAdmin();

      // Get all routers
      let routers = providedRouter ? [providedRouter] : null;
      let routerErr = null;
      if (!routers) {
        let routersQuery = supabase.from("mikrotik_routers").select("*").eq("status", "active");
        if (requestedRouterId) {
          routersQuery = routersQuery.eq("id", requestedRouterId);
        }

        const routerResponse = await routersQuery;
        routers = routerResponse.data;
        routerErr = routerResponse.error;

        if (requestedRouterId && !routers?.length) {
          return jsonResponse({
            success: false,
            error: "Selected router not found or inactive",
            results: { total: 0, pushed: 0, imported: 0, updated: 0, failed: 0, errors: [] },
          });
        }
      }

      if (routerErr || !routers?.length) {
        // Fallback to env router
        const envRouter = getEnvRouter();
        if (!envRouter.ip_address) {
          return jsonResponse({
            success: false,
            error: "No active routers configured",
            results: { total: 0, pushed: 0, imported: 0, updated: 0, failed: 0, errors: [] },
          });
        }
      }

      const allRouters = routers?.length ? routers : [{ ...getEnvRouter(), id: "env-default", name: "Default Router" }];

      let pushed = 0;
      let imported = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      // Get all packages for profile mapping
      const { data: packageRows } = await supabase.from("packages").select("id, name, mikrotik_profile_name, monthly_price, speed, router_id");
      const allPackages = requestedRouterId
        ? (packageRows || []).filter((pkg: any) => !pkg.router_id || pkg.router_id === requestedRouterId)
        : packageRows;

      for (const router of allRouters) {
        const routerConfig = { ip_address: router.ip_address, username: router.username, password: router.password, api_port: router.api_port || 8728 };

        try {
          await withRouter(routerConfig, async (mt) => {
            // ── Step 1: Sync PPP Profiles (packages) ──
            try {
              const profileRes = await mt.send(["/ppp/profile/print"]);
              const mkProfiles = parseItems(profileRes.sentences);

              // Ensure all software packages have profiles on router
              for (const pkg of allPackages || []) {
                if (!pkg.mikrotik_profile_name || pkg.mikrotik_profile_name === "default") continue;
                const exists = mkProfiles.some((p: any) => p.name === pkg.mikrotik_profile_name);
                if (!exists) {
                  try {
                    await mt.send(["/ppp/profile/add", `=name=${pkg.mikrotik_profile_name}`, "=local-address=10.10.10.1"]);
                    console.log(`Created profile: ${pkg.mikrotik_profile_name}`);
                  } catch (e) {
                    console.error(`Profile create failed: ${pkg.mikrotik_profile_name}`, e.message);
                  }
                }
              }
            } catch (e) {
              console.error("Profile sync failed:", e.message);
            }

            // ── Step 2: Get all PPPoE secrets from MikroTik ──
            const secretsRes = await mt.send(["/ppp/secret/print"]);
            const mkSecrets = parseItems(secretsRes.sentences);

            // ── Step 3: Get all software customers for this router ──
            const routerFilter = requestedRouterId || (router.id !== "env-default" && router.id !== "provided-router" ? router.id : null);
            let query = supabase.from("customers").select("id, pppoe_username, pppoe_password, router_id, name, status, package_id").neq("status", "disconnected");
            if (routerFilter) {
              query = query.eq("router_id", routerFilter);
            }
            const { data: swCustomers } = await query;

            const swUsernameMap: Record<string, any> = {};
            for (const c of swCustomers || []) {
              if (c.pppoe_username) swUsernameMap[c.pppoe_username] = c;
            }

            // ── Step 4: Push software users → MikroTik ──
            for (const c of swCustomers || []) {
              if (!c.pppoe_username) continue;
              try {
                let profileName = "default";
                if (c.package_id) {
                  const pkg = (allPackages || []).find((p: any) => p.id === c.package_id);
                  if (pkg?.mikrotik_profile_name) profileName = pkg.mikrotik_profile_name;
                }

                const mkUser = mkSecrets.find((s: any) => s.name === c.pppoe_username);
                if (mkUser) {
                  // Update existing
                  const words = ["/ppp/secret/set", `=.id=${mkUser[".id"]}`, `=profile=${profileName}`, `=comment=${c.name || ""}`];
                  if (c.pppoe_password) words.push(`=password=${c.pppoe_password}`);
                  const shouldDisable = c.status === "inactive" || c.status === "suspended";
                  words.push(`=disabled=${shouldDisable ? "yes" : "no"}`);
                  const res = await mt.send(words);
                  if (res.trap) throw new Error(res.trap);
                  updated++;
                } else {
                  // Create new on MikroTik
                  if (!c.pppoe_password) {
                    errors.push(`${c.pppoe_username}: No password, skipped`);
                    failed++;
                    continue;
                  }
                  await ensureProfileExists(mt, profileName);
                  const words = ["/ppp/secret/add", `=name=${c.pppoe_username}`, `=password=${c.pppoe_password}`, `=service=pppoe`, `=profile=${profileName}`, `=comment=${c.name || ""}`];
                  const res = await mt.send(words);
                  if (res.trap) throw new Error(res.trap);
                  pushed++;
                }

                await supabase.from("customers").update({ mikrotik_sync_status: "synced" }).eq("id", c.id);
              } catch (e) {
                failed++;
                errors.push(`Push ${c.pppoe_username}: ${e.message}`);
                await supabase.from("customers").update({ mikrotik_sync_status: "failed" }).eq("id", c.id);
              }
            }

            // ── Step 5: Import MikroTik users → Software ──
            for (const secret of mkSecrets) {
              const username = secret.name;
              if (!username || swUsernameMap[username]) continue; // Already exists in software

              try {
                // Find matching package by profile name
                const profileName = secret.profile || "default";
                const matchedPkg = (allPackages || []).find((p: any) => p.mikrotik_profile_name === profileName);

                // Generate customer_id
                const { data: lastCust } = await supabase
                  .from("customers")
                  .select("customer_id")
                  .order("customer_id", { ascending: false })
                  .limit(1);

                let nextNum = 1;
                if (lastCust?.length) {
                  const match = lastCust[0].customer_id.match(/ISP-(\d+)/);
                  if (match) nextNum = parseInt(match[1]) + 1;
                }
                const customerId = `ISP-${String(nextNum).padStart(5, "0")}`;

                const newCustomer: any = {
                  customer_id: customerId,
                  name: secret.comment || username,
                  phone: "N/A",
                  area: "Imported from MikroTik",
                  pppoe_username: username,
                  pppoe_password: secret.password || null,
                  status: secret.disabled === "true" || secret.disabled === "yes" ? "inactive" : "active",
                  connection_status: secret.disabled === "true" || secret.disabled === "yes" ? "suspended" : "active",
                  mikrotik_sync_status: "synced",
                  monthly_bill: matchedPkg?.monthly_price || 0,
                  package_id: matchedPkg?.id || null,
                };

                if (routerFilter) {
                  newCustomer.router_id = routerFilter;
                }

                const { error: insertErr } = await supabase.from("customers").insert(newCustomer);
                if (insertErr) {
                  if (insertErr.message?.includes("duplicate")) {
                    // Skip duplicates silently
                    continue;
                  }
                  throw new Error(insertErr.message);
                }
                imported++;
              } catch (e) {
                failed++;
                errors.push(`Import ${username}: ${e.message}`);
              }
            }
          });
        } catch (routerErr: any) {
          errors.push(`Router ${router.name || router.ip_address}: ${routerErr.message || "Connection failed"}`);
          failed++;
        }
      }

      return jsonResponse({
        success: true,
        results: {
          total: pushed + imported + updated + failed,
          pushed,
          imported,
          updated,
          failed,
          errors: errors.slice(0, 20),
        },
      });
    }

    // ─── SYNC IP POOLS FROM ROUTER ────────────────────────────
    if (req.method === "POST" && path === "sync-ip-pools") {
      const body = await req.json().catch(() => ({}));
      const routerId = body?.router_id;
      if (!routerId) return jsonResponse({ success: false, error: "Missing router_id" }, 400);

      const supabase = getSupabaseAdmin();
      const router = await getRouterById(supabase, routerId);
      if (!router) return jsonResponse({ success: false, error: "Router not found" }, 404);

      try {
        const pools = await withRouter(router, async (mt) => {
          const res = await mt.send(["/ip/pool/print"]);
          return parseItems(res.sentences);
        });

        let synced = 0;
        for (const pool of pools) {
          const name = pool.name || "";
          const ranges = pool.ranges || "";
          if (!name) continue;

          // Parse start/end IP from ranges (format: "192.168.1.10-192.168.1.254")
          let startIp = "", endIp = "", subnet = ranges;
          const rangeParts = ranges.split("-");
          if (rangeParts.length === 2) {
            startIp = rangeParts[0].trim();
            endIp = rangeParts[1].trim();
          }

          // Calculate total IPs
          let totalIps = 0;
          if (startIp && endIp) {
            const startParts = startIp.split(".").map(Number);
            const endParts = endIp.split(".").map(Number);
            const startNum = (startParts[0] << 24) + (startParts[1] << 16) + (startParts[2] << 8) + startParts[3];
            const endNum = (endParts[0] << 24) + (endParts[1] << 16) + (endParts[2] << 8) + endParts[3];
            totalIps = Math.max(0, endNum - startNum + 1);
          }

          const mikrotikId = pool[".id"] || null;

          // Upsert by router_id + name
          const { data: existing } = await supabase
            .from("ip_pools")
            .select("id")
            .eq("router_id", routerId)
            .eq("name", name)
            .maybeSingle();

          if (existing) {
            await supabase.from("ip_pools").update({
              ranges, subnet: subnet || ranges, start_ip: startIp, end_ip: endIp,
              total_ips: totalIps, mikrotik_id: mikrotikId, status: "active",
            }).eq("id", existing.id);
          } else {
            await supabase.from("ip_pools").insert({
              name, router_id: routerId, ranges, subnet: subnet || ranges,
              start_ip: startIp, end_ip: endIp, total_ips: totalIps,
              mikrotik_id: mikrotikId, status: "active", used_ips: 0,
            });
          }
          synced++;
        }

        return jsonResponse({ success: true, synced });
      } catch (e: any) {
        console.error("IP Pool sync failed:", e.message);
        return jsonResponse({ success: false, error: e.message }, 502);
      }
    }

    // ─── PUSH SINGLE IP POOL TO ROUTER ──────────────────────────
    if (req.method === "POST" && path === "push-ip-pool") {
      const body = await req.json().catch(() => ({}));
      const poolId = body?.pool_id;
      if (!poolId) return jsonResponse({ success: false, error: "Missing pool_id" }, 400);

      const supabase = getSupabaseAdmin();
      const { data: pool } = await supabase.from("ip_pools").select("*, mikrotik_routers(*)").eq("id", poolId).single();
      if (!pool) return jsonResponse({ success: false, error: "Pool not found" }, 404);

      const router = pool.mikrotik_routers;
      if (!router) return jsonResponse({ success: false, error: "No router assigned to this pool" }, 400);

      try {
        await withRouter(router, async (mt) => {
          const ranges = pool.ranges || (pool.start_ip && pool.end_ip ? `${pool.start_ip}-${pool.end_ip}` : pool.subnet);
          if (!ranges) throw new Error("No IP range defined");

          // Check if pool exists on router
          const listRes = await mt.send(["/ip/pool/print", `?name=${pool.name}`]);
          const existing = parseItems(listRes.sentences);

          if (existing.length > 0) {
            const res = await mt.send(["/ip/pool/set", `=.id=${existing[0][".id"]}`, `=ranges=${ranges}`]);
            if (res.trap) throw new Error(res.trap);
          } else {
            const res = await mt.send(["/ip/pool/add", `=name=${pool.name}`, `=ranges=${ranges}`]);
            if (res.trap) throw new Error(res.trap);
          }
        });

        return jsonResponse({ success: true, message: `Pool "${pool.name}" pushed successfully` });
      } catch (e: any) {
        console.error("IP Pool push failed:", e.message);
        return jsonResponse({ success: false, error: e.message }, 502);
      }
    }

    // ─── PUSH ALL IP POOLS TO ROUTER ────────────────────────────
    if (req.method === "POST" && path === "push-all-ip-pools") {
      const body = await req.json().catch(() => ({}));
      const routerId = body?.router_id;
      if (!routerId) return jsonResponse({ success: false, error: "Missing router_id" }, 400);

      const supabase = getSupabaseAdmin();
      const router = await getRouterById(supabase, routerId);
      if (!router) return jsonResponse({ success: false, error: "Router not found" }, 404);

      const { data: pools } = await supabase.from("ip_pools").select("*").eq("router_id", routerId);
      if (!pools?.length) return jsonResponse({ success: true, pushed: 0, failed: 0, errors: [] });

      const results = { pushed: 0, failed: 0, errors: [] as string[] };

      try {
        await withRouter(router, async (mt) => {
          for (const pool of pools) {
            try {
              const ranges = pool.ranges || (pool.start_ip && pool.end_ip ? `${pool.start_ip}-${pool.end_ip}` : pool.subnet);
              if (!ranges) { results.failed++; results.errors.push(`${pool.name}: No IP range`); continue; }

              const listRes = await mt.send(["/ip/pool/print", `?name=${pool.name}`]);
              const existing = parseItems(listRes.sentences);

              if (existing.length > 0) {
                const res = await mt.send(["/ip/pool/set", `=.id=${existing[0][".id"]}`, `=ranges=${ranges}`]);
                if (res.trap) throw new Error(res.trap);
              } else {
                const res = await mt.send(["/ip/pool/add", `=name=${pool.name}`, `=ranges=${ranges}`]);
                if (res.trap) throw new Error(res.trap);
              }
              results.pushed++;
            } catch (e: any) {
              results.failed++;
              results.errors.push(`${pool.name}: ${e.message}`);
            }
          }
        });
      } catch (e: any) {
        return jsonResponse({ success: false, error: `Router connection failed: ${e.message}` }, 502);
      }

      return jsonResponse({ success: true, ...results });
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (err) {
    console.error("MikroTik edge function error:", err);
    return jsonResponse({ error: getErrorMessage(err) || "Internal server error" }, 500);
  }
});
