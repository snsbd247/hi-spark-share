/**
 * Phase 8 — Laravel Reverb (Pusher protocol) live push client.
 *
 * Lazy-init: only constructs Echo when first subscribe is requested AND a
 * Reverb host is configured. If env vars are missing, returns null so the
 * UI silently falls back to polling — no crash, no toasts.
 *
 * Configure via VITE_REVERB_APP_KEY, VITE_REVERB_HOST (e.g. ws.example.com),
 * VITE_REVERB_PORT (default 8080), VITE_REVERB_SCHEME (http|https).
 */
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import api from "@/lib/api";

declare global {
  interface Window { Pusher: typeof Pusher; __echo?: any }
}

let echoInstance: any = null;
let initTried = false;

function getEnv(k: string): string | undefined {
  // Vite env or runtime override on window.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (import.meta as any).env?.[k] ?? (window as any)[k];
}

export function getEcho(): any | null {
  if (echoInstance) return echoInstance;
  if (initTried) return null;
  initTried = true;

  const key = getEnv("VITE_REVERB_APP_KEY");
  const host = getEnv("VITE_REVERB_HOST");
  if (!key || !host) {
    // Reverb not configured — caller should fall back to polling.
    return null;
  }

  try {
    window.Pusher = Pusher;
    const port = parseInt(getEnv("VITE_REVERB_PORT") || "8080", 10);
    const scheme = (getEnv("VITE_REVERB_SCHEME") || "https").toLowerCase();
    const forceTLS = scheme === "https";

    echoInstance = new Echo({
      broadcaster: "reverb",
      key,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS,
      enabledTransports: ["ws", "wss"],
      authorizer: (channel: any) => ({
        authorize: (socketId: string, callback: (err: any, data?: any) => void) => {
          api
            .post("/api/broadcasting/auth", { socket_id: socketId, channel_name: channel.name })
            .then((r) => callback(null, r.data))
            .catch((e) => callback(e));
        },
      }),
    });
    window.__echo = echoInstance;
    return echoInstance;
  } catch (e) {
    console.warn("[echo] init failed, falling back to polling", e);
    return null;
  }
}

export interface OnuStatusPushPayload {
  olt_device_id: string;
  olt_name: string;
  count: number;
  summary: { updated?: number; inserted?: number; linked?: number; signal_synced?: number };
  polled_at: string;
}

/**
 * Subscribe to ONU status pushes for a given tenant. Returns an unsubscribe fn.
 * If Reverb is unavailable, returns a no-op cleanup.
 */
export function subscribeOnuStatus(
  tenantId: string | null | undefined,
  handler: (payload: OnuStatusPushPayload) => void,
): () => void {
  const echo = getEcho();
  if (!echo) return () => {};
  const channelName = tenantId ? `tenant.${tenantId}.fiber` : "public.fiber";
  try {
    const channel = tenantId ? echo.private(channelName) : echo.channel(channelName);
    channel.listen(".onu.status.updated", handler);
    return () => {
      try { echo.leave(channelName); } catch { /* ignore */ }
    };
  } catch (e) {
    console.warn("[echo] subscribe failed", e);
    return () => {};
  }
}
