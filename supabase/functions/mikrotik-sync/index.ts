import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MikroTik REST API helper — uses per-router credentials from DB when available
async function mikrotikRequestWithRouter(
  router: { ip_address: string; username: string; password: string; api_port: number },
  path: string,
  method: string = "GET",
  body?: any
) {
  const url = `https://${router.ip_address}/rest${path}`;
  const auth = btoa(`${router.username}:${router.password}`);

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MikroTik API error (${res.status}): ${text}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await res.json();
  }
  return null;
}

// Fallback: use env vars for router credentials
function getEnvRouter() {
  return {
    ip_address: Deno.env.get("MIKROTIK_HOST")!,
    username: Deno.env.get("MIKROTIK_USERNAME")!,
    password: Deno.env.get("MIKROTIK_PASSWORD")!,
    api_port: 8728,
  };
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getRouterById(supabase: any, routerId: string) {
  const { data, error } = await supabase
    .from("mikrotik_routers")
    .select("*")
    .eq("id", routerId)
    .single();
  if (error || !data) return null;
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // ─── CREATE PPPOE USER ──────────────────────────────────────
    if (req.method === "POST" && path === "create-pppoe") {
      const { customer_id, pppoe_username, pppoe_password, profile_name, comment, router_id } = await req.json();

      if (!pppoe_username || !pppoe_password) {
        return new Response(JSON.stringify({ error: "Missing PPPoE credentials" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getSupabaseAdmin();
      const router = router_id ? await getRouterById(supabase, router_id) : null;
      const routerConfig = router || getEnvRouter();

      try {
        // Check if PPPoE secret already exists
        const secrets = await mikrotikRequestWithRouter(routerConfig, "/ppp/secret");
        const existing = secrets?.find((s: any) => s.name === pppoe_username);

        if (existing) {
          // Update existing
          await mikrotikRequestWithRouter(routerConfig, `/ppp/secret/${existing[".id"]}`, "PATCH", {
            password: pppoe_password,
            profile: profile_name || "default",
            comment: comment || "",
          });
        } else {
          // Create new PPPoE secret
          await mikrotikRequestWithRouter(routerConfig, "/ppp/secret", "PUT", {
            name: pppoe_username,
            password: pppoe_password,
            service: "pppoe",
            profile: profile_name || "default",
            comment: comment || "",
          });
        }

        // Update customer connection_status
        if (customer_id) {
          await supabase
            .from("customers")
            .update({ connection_status: "active" })
            .eq("id", customer_id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("PPPoE create failed:", e.message);
        return new Response(JSON.stringify({ error: "MikroTik PPPoE creation failed", details: e.message }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── DISABLE PPPOE USER ─────────────────────────────────────
    if (req.method === "POST" && path === "disable-pppoe") {
      const { pppoe_username, router_id, customer_id } = await req.json();

      if (!pppoe_username) {
        return new Response(JSON.stringify({ error: "Missing pppoe_username" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getSupabaseAdmin();
      const router = router_id ? await getRouterById(supabase, router_id) : null;
      const routerConfig = router || getEnvRouter();

      try {
        const secrets = await mikrotikRequestWithRouter(routerConfig, "/ppp/secret");
        const existing = secrets?.find((s: any) => s.name === pppoe_username);

        if (existing) {
          await mikrotikRequestWithRouter(routerConfig, `/ppp/secret/${existing[".id"]}`, "PATCH", {
            disabled: "true",
          });

          // Also disconnect active session
          try {
            const active = await mikrotikRequestWithRouter(routerConfig, "/ppp/active");
            const session = active?.find((a: any) => a.name === pppoe_username);
            if (session) {
              await mikrotikRequestWithRouter(routerConfig, `/ppp/active/${session[".id"]}`, "DELETE");
            }
          } catch (e) {
            console.error("Failed to disconnect active session:", e.message);
          }
        }

        if (customer_id) {
          await supabase
            .from("customers")
            .update({ connection_status: "suspended", status: "suspended" })
            .eq("id", customer_id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("PPPoE disable failed:", e.message);
        return new Response(JSON.stringify({ error: "MikroTik disable failed", details: e.message }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── ENABLE PPPOE USER ──────────────────────────────────────
    if (req.method === "POST" && path === "enable-pppoe") {
      const { pppoe_username, router_id, customer_id } = await req.json();

      if (!pppoe_username) {
        return new Response(JSON.stringify({ error: "Missing pppoe_username" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getSupabaseAdmin();
      const router = router_id ? await getRouterById(supabase, router_id) : null;
      const routerConfig = router || getEnvRouter();

      try {
        const secrets = await mikrotikRequestWithRouter(routerConfig, "/ppp/secret");
        const existing = secrets?.find((s: any) => s.name === pppoe_username);

        if (existing) {
          await mikrotikRequestWithRouter(routerConfig, `/ppp/secret/${existing[".id"]}`, "PATCH", {
            disabled: "false",
          });
        }

        if (customer_id) {
          await supabase
            .from("customers")
            .update({ connection_status: "active", status: "active" })
            .eq("id", customer_id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("PPPoE enable failed:", e.message);
        return new Response(JSON.stringify({ error: "MikroTik enable failed", details: e.message }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── BILL CONTROL: Suspend overdue, reactivate paid ─────────
    if (req.method === "POST" && path === "bill-control") {
      const supabase = getSupabaseAdmin();
      const results = { suspended: 0, reactivated: 0, errors: [] as string[] };

      // 1. Find overdue unpaid bills and suspend those customers
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
            const router = cust.router_id ? await getRouterById(supabase, cust.router_id) : null;
            const routerConfig = router || getEnvRouter();

            const secrets = await mikrotikRequestWithRouter(routerConfig, "/ppp/secret");
            const existing = secrets?.find((s: any) => s.name === cust.pppoe_username);

            if (existing) {
              await mikrotikRequestWithRouter(routerConfig, `/ppp/secret/${existing[".id"]}`, "PATCH", {
                disabled: "true",
              });

              // Disconnect active session
              try {
                const active = await mikrotikRequestWithRouter(routerConfig, "/ppp/active");
                const session = active?.find((a: any) => a.name === cust.pppoe_username);
                if (session) {
                  await mikrotikRequestWithRouter(routerConfig, `/ppp/active/${session[".id"]}`, "DELETE");
                }
              } catch { /* ignore */ }
            }

            await supabase
              .from("customers")
              .update({ connection_status: "suspended", status: "suspended" })
              .eq("id", cust.id);

            results.suspended++;
          } catch (e) {
            console.error(`Failed to suspend ${cust.id}:`, e.message);
            results.errors.push(`Suspend ${cust.id}: ${e.message}`);
          }
        }
      }

      // 2. Find customers pending reactivation (from payment trigger) or suspended with no overdue bills
      const { data: reactivateCandidates } = await supabase
        .from("customers")
        .select("id, pppoe_username, router_id, connection_status")
        .in("connection_status", ["suspended", "pending_reactivation"])
        .not("pppoe_username", "is", null);

      if (reactivateCandidates) {
        for (const cust of reactivateCandidates) {
          // For suspended customers, verify no overdue bills remain
          if (cust.connection_status === "suspended") {
            const { data: unpaidBills } = await supabase
              .from("bills")
              .select("id")
              .eq("customer_id", cust.id)
              .eq("status", "unpaid")
              .lt("due_date", today)
              .limit(1);

            if (unpaidBills && unpaidBills.length > 0) continue;
          }

          try {
            const router = cust.router_id ? await getRouterById(supabase, cust.router_id) : null;
            const routerConfig = router || getEnvRouter();

            const secrets = await mikrotikRequestWithRouter(routerConfig, "/ppp/secret");
            const existing = secrets?.find((s: any) => s.name === cust.pppoe_username);

            if (existing) {
              await mikrotikRequestWithRouter(routerConfig, `/ppp/secret/${existing[".id"]}`, "PATCH", {
                disabled: "false",
              });
            }

            await supabase
              .from("customers")
              .update({ connection_status: "active", status: "active" })
              .eq("id", cust.id);

            results.reactivated++;
          } catch (e) {
            console.error(`Failed to reactivate ${cust.id}:`, e.message);
            results.errors.push(`Reactivate ${cust.id}: ${e.message}`);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── SYNC PROFILE (existing) ────────────────────────────────
    if (req.method === "POST" && path === "sync-profile") {
      const { package_id } = await req.json();

      if (!package_id) {
        return new Response(JSON.stringify({ error: "Missing package_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getSupabaseAdmin();
      const { data: pkg, error } = await supabase
        .from("packages")
        .select("*")
        .eq("id", package_id)
        .single();

      if (error || !pkg) {
        return new Response(JSON.stringify({ error: "Package not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const routerConfig = getEnvRouter();
      const profileName = pkg.mikrotik_profile_name || `ISP-${pkg.name.replace(/\s+/g, "-")}`;
      const downloadLimit = `${pkg.download_speed}M`;
      const uploadLimit = `${pkg.upload_speed}M`;
      const maxLimit = `${uploadLimit}/${downloadLimit}`;

      try {
        const profiles = await mikrotikRequestWithRouter(routerConfig, "/ppp/profile");
        const existing = profiles?.find((p: any) => p.name === profileName);

        if (existing) {
          await mikrotikRequestWithRouter(routerConfig, `/ppp/profile/${existing[".id"]}`, "PATCH", {
            name: profileName,
            "rate-limit": maxLimit,
          });
        } else {
          await mikrotikRequestWithRouter(routerConfig, "/ppp/profile", "PUT", {
            name: profileName,
            "rate-limit": maxLimit,
            "local-address": "10.10.10.1",
          });
        }
      } catch (e) {
        console.error("PPP profile sync failed:", e.message);
      }

      await supabase
        .from("packages")
        .update({ mikrotik_profile_name: profileName })
        .eq("id", package_id);

      return new Response(JSON.stringify({ success: true, profile_name: profileName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── SYNC CUSTOMER (existing) ───────────────────────────────
    if (req.method === "POST" && path === "sync-customer") {
      const { customer_id } = await req.json();

      const supabase = getSupabaseAdmin();
      const { data: customer } = await supabase
        .from("customers")
        .select("*, packages(download_speed, upload_speed, mikrotik_profile_name)")
        .eq("id", customer_id)
        .single();

      if (!customer || !customer.ip_address || !customer.packages) {
        return new Response(JSON.stringify({ error: "Customer, IP, or package not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const router = customer.router_id ? await getRouterById(supabase, customer.router_id) : null;
      const routerConfig = router || getEnvRouter();
      const pkg = customer.packages;
      const maxLimit = `${pkg.upload_speed}M/${pkg.download_speed}M`;

      try {
        const queues = await mikrotikRequestWithRouter(routerConfig, "/queue/simple");
        const existing = queues?.find((q: any) =>
          q.target === `${customer.ip_address}/32` || q.name === customer.customer_id
        );

        if (existing) {
          await mikrotikRequestWithRouter(routerConfig, `/queue/simple/${existing[".id"]}`, "PATCH", {
            "max-limit": maxLimit,
          });
        } else {
          await mikrotikRequestWithRouter(routerConfig, "/queue/simple", "PUT", {
            name: customer.customer_id,
            target: `${customer.ip_address}/32`,
            "max-limit": maxLimit,
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "MikroTik sync failed", details: e.message }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("MikroTik edge function error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
