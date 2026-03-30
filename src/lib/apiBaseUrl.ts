/**
 * API Base URL — Auto-detection for multi-domain deployment
 *
 * Resolution order:
 * 1. VITE_API_URL env var (explicit override)
 * 2. localhost / private IP → http://localhost:8000/api (local dev)
 * 3. Any other domain → auto-detect: https://<current-domain>/api/api
 *    (same build works on ANY cPanel domain without rebuilding)
 */

const LOCAL_API_BASE_URL = "http://localhost:8000/api";

const envApiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, "") || "";

const hostname = typeof window !== "undefined" ? window.location.hostname : "";

/** Detect local development: localhost, 127.0.0.1, or private network IPs */
const isLocalDev =
  /^(localhost|127\.0\.0\.1)$/.test(hostname) ||
  /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

/**
 * API_BASE_URL resolution:
 * 1. Explicit VITE_API_URL → use it
 * 2. Local dev (localhost / private IP) → localhost:8000/api
 * 3. Any cPanel domain → auto-detect from current domain
 */
export const API_BASE_URL = (() => {
  if (envApiBaseUrl) return envApiBaseUrl;
  if (isLocalDev) return LOCAL_API_BASE_URL;
  // Auto-detect for cPanel: https://<domain>/api/api
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/api`;
  }
  return LOCAL_API_BASE_URL;
})();

export const API_PUBLIC_ROOT = API_BASE_URL.replace(/\/api$/, "");
