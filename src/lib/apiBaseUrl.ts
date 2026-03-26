const LOCAL_API_BASE_URL = "http://localhost:8000/api";

const envApiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, "") || "";
const isEnvLocalhost = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(envApiBaseUrl);

const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(hostname);
const isLovablePreview = hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com");

// Only treat as custom-domain-with-Laravel if VITE_API_URL is explicitly set to a non-localhost URL
const hasExplicitApiUrl = !!envApiBaseUrl && !isEnvLocalhost;

// Auto-detect API URL only when an explicit production API URL is configured
const autoDetectedApiUrl = (!isLocalHost && !isLovablePreview && hasExplicitApiUrl)
  ? envApiBaseUrl
  : "";

export const API_BASE_URL = (() => {
  if (hasExplicitApiUrl) return envApiBaseUrl;
  if (isLocalHost) return envApiBaseUrl || LOCAL_API_BASE_URL;
  // On Lovable preview or custom domain without explicit API URL → use localhost placeholder
  // (will trigger network error → edge function fallback in apiDb.ts)
  return LOCAL_API_BASE_URL;
})();

export const API_PUBLIC_ROOT = API_BASE_URL.replace(/\/api$/, "");
// IS_LOVABLE_RUNTIME enables Supabase edge function fallback
export const IS_LOVABLE_RUNTIME = isLovablePreview || (!isLocalHost && !hasExplicitApiUrl);
