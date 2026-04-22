/**
 * Build-time + runtime cache invalidation strategy for wallet/admin pages.
 *
 * - BUILD_VERSION is stamped at build time via vite's `define` (or falls back to dev).
 * - On page mount we compare the value stored in localStorage. If it changed,
 *   we wipe the wallet/settlement react-query cache keys and reload once.
 * - This prevents stale chunks from a previous deploy holding on to old types
 *   (the kind of issue that surfaced as the "apiClient" stale build error).
 */
export const BUILD_VERSION =
  (typeof __BUILD_VERSION__ !== "undefined" && __BUILD_VERSION__) ||
  (import.meta.env.VITE_BUILD_VERSION as string | undefined) ||
  "dev";

const STORAGE_KEY = "smartisp_build_version";

/** Returns `true` if the build version changed since the last visit. */
export function checkBuildVersion(): boolean {
  if (typeof window === "undefined") return false;
  const prev = window.localStorage.getItem(STORAGE_KEY);
  if (prev !== BUILD_VERSION) {
    window.localStorage.setItem(STORAGE_KEY, BUILD_VERSION);
    return prev !== null; // first ever visit shouldn't trigger reload
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
