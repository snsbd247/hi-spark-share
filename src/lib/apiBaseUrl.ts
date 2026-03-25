const LOCAL_API_BASE_URL = "http://localhost:8000/api";
const PREVIEW_FALLBACK_API_BASE_URL = "https://isp.syncsolutionbd.com/api/api";

const envApiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, "") || "";
const isEnvLocalhost = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(envApiBaseUrl);

const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(hostname);
const isLovablePreview = hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com");
const isLovableCustomDomain = !isLocalHost && !isLovablePreview && typeof window !== "undefined" && !envApiBaseUrl;

export const API_BASE_URL = (() => {
  if (envApiBaseUrl && !isEnvLocalhost) return envApiBaseUrl;
  if (isLocalHost) return envApiBaseUrl || LOCAL_API_BASE_URL;
  if (isLovablePreview) return PREVIEW_FALLBACK_API_BASE_URL;
  return envApiBaseUrl || PREVIEW_FALLBACK_API_BASE_URL;
})();

export const API_PUBLIC_ROOT = API_BASE_URL.replace(/\/api$/, "");
export const IS_LOVABLE_RUNTIME = isLovablePreview;
