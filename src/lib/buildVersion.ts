/**
 * Deterministic cache key/versioning for admin wallet pages.
 *
 * - BUILD_VERSION is stamped at build time by Vite (`define`) — see vite.config.ts.
 * - CACHE_NAMESPACE combines BUILD_VERSION + a schema revision so we can bust caches
 *   independently when the API contract changes without a full redeploy.
 * - All wallet/admin localStorage keys SHOULD be prefixed via `nsKey()` so they're
 *   automatically scoped per build and are purged on version mismatch.
 */
export const BUILD_VERSION =
  (typeof __BUILD_VERSION__ !== "undefined" && __BUILD_VERSION__) ||
  (import.meta.env.VITE_BUILD_VERSION as string | undefined) ||
  "dev";

/** Bump this when the wallet/settlement API response shape changes. */
export const WALLET_SCHEMA_REV = "v3";

/** Composite, deterministic cache namespace. */
export const CACHE_NAMESPACE = `${BUILD_VERSION}:${WALLET_SCHEMA_REV}`;

const STORAGE_KEY = "smartisp_cache_namespace";

/** Prefix a localStorage/sessionStorage key with the current build namespace. */
export function nsKey(key: string): string {
  return `wallet:${CACHE_NAMESPACE}:${key}`;
}

/** React Query key prefix for wallet pages — guarantees a deterministic per-build root. */
export function nsQueryKey(...parts: unknown[]): unknown[] {
  return [CACHE_NAMESPACE, ...parts];
}

/** Returns `true` if the cache namespace changed since the last visit. */
export function checkBuildVersion(): boolean {
  if (typeof window === "undefined") return false;
  const prev = window.localStorage.getItem(STORAGE_KEY);
  if (prev !== CACHE_NAMESPACE) {
    window.localStorage.setItem(STORAGE_KEY, CACHE_NAMESPACE);
    return prev !== null; // first ever visit shouldn't trigger purge
  }
  return false;
}

/** Wipe wallet/settlement-related cache keys (call when build version changes). */
export function purgeWalletCache(): void {
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.localStorage)
      .filter((k) => /wallet|settlement|coa-account/i.test(k))
      .forEach((k) => window.localStorage.removeItem(k));
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  } catch {
    /* noop */
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __BUILD_VERSION__: string | undefined;
}
