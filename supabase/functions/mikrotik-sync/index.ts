import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MikroTik REST API helper (RouterOS v7+)
// Note: For RouterOS API protocol, a TCP socket library would be needed.
// Using REST API as it's more compatible with edge functions.
async function mikrotikRequest(path: string, method: string = "GET", body?: any) {
  const host = Deno.env.get("MIKROTIK_HOST")!;
  const username = Deno.env.get("MIKROTIK_USERNAME")!;
  const password = Deno.env.get("MIKROTIK_PASSWORD")!;

  const url = `https://${host}/rest${path}`;
  const auth = btoa(`${username}:${password}`);

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

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Sync a package's bandwidth profile to MikroTik
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

      const profileName = pkg.mikrotik_profile_name || `ISP-${pkg.name.replace(/\s+/g, "-")}`;
      const downloadLimit = `${pkg.download_speed}M`;
      const uploadLimit = `${pkg.upload_speed}M`;
      const maxLimit = `${uploadLimit}/${downloadLimit}`;

      // Check if profile exists
      let existingProfiles;
      try {
        existingProfiles = await mikrotikRequest("/queue/simple");
      } catch (e) {
        // Try /queue/type for profile-based approach
        try {
          existingProfiles = await mikrotikRequest("/ppp/profile");
        } catch {
          return new Response(JSON.stringify({ error: "Cannot connect to MikroTik", details: e.message }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Create or update PPP profile
      try {
        const profiles = await mikrotikRequest("/ppp/profile");
        const existing = profiles?.find((p: any) => p.name === profileName);

        if (existing) {
          // Update existing profile
          await mikrotikRequest(`/ppp/profile/${existing[".id"]}`, "PATCH", {
            name: profileName,
            "rate-limit": maxLimit,
          });
        } else {
          // Create new profile
          await mikrotikRequest("/ppp/profile", "PUT", {
            name: profileName,
            "rate-limit": maxLimit,
            "local-address": "10.10.10.1",
          });
        }
      } catch (e) {
        console.error("PPP profile sync failed, trying simple queue:", e.message);

        // Fallback: Update simple queues for customers on this package
        const { data: customers } = await supabase
          .from("customers")
          .select("ip_address, name, customer_id")
          .eq("package_id", package_id)
          .not("ip_address", "is", null);

        if (customers && customers.length > 0) {
          for (const customer of customers) {
            if (!customer.ip_address) continue;

            try {
              const queues = await mikrotikRequest("/queue/simple");
              const existing = queues?.find((q: any) =>
                q.target === `${customer.ip_address}/32` || q.name === customer.customer_id
              );

              if (existing) {
                await mikrotikRequest(`/queue/simple/${existing[".id"]}`, "PATCH", {
                  "max-limit": maxLimit,
                });
              } else {
                await mikrotikRequest("/queue/simple", "PUT", {
                  name: customer.customer_id,
                  target: `${customer.ip_address}/32`,
                  "max-limit": maxLimit,
                });
              }
            } catch (qErr) {
              console.error(`Failed to update queue for ${customer.customer_id}:`, qErr.message);
            }
          }
        }
      }

      // Update package with profile name
      await supabase
        .from("packages")
        .update({ mikrotik_profile_name: profileName })
        .eq("id", package_id);

      return new Response(JSON.stringify({ success: true, profile_name: profileName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync a single customer's bandwidth
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

      const pkg = customer.packages;
      const maxLimit = `${pkg.upload_speed}M/${pkg.download_speed}M`;

      try {
        const queues = await mikrotikRequest("/queue/simple");
        const existing = queues?.find((q: any) =>
          q.target === `${customer.ip_address}/32` || q.name === customer.customer_id
        );

        if (existing) {
          await mikrotikRequest(`/queue/simple/${existing[".id"]}`, "PATCH", {
            "max-limit": maxLimit,
          });
        } else {
          await mikrotikRequest("/queue/simple", "PUT", {
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
