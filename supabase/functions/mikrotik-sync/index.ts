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

async function connectMikroTik(host: string, port: number, username: string, password: string): Promise<MikroTikConnection> {
  const conn = await Deno.connect({ hostname: host, port, transport: "tcp" });
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
        return new Response(JSON.stringify({ error: "Missing router credentials" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const result = await withRouter({ ip_address, username, password, api_port: api_port || 8728 }, async (mt) => {
          const identityRes = await mt.send(["/system/identity/print"]);
          const resourceRes = await mt.send(["/system/resource/print"]);
          const identity = parseItems(identityRes.sentences);
          const resource = parseItems(resourceRes.sentences);
          return { identity: identity[0]?.name || "Unknown", version: resource[0]?.version || "Unknown", uptime: resource[0]?.uptime || "Unknown" };
        });
        return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("MikroTik edge function error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
