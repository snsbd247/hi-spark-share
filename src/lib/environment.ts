/**
 * Environment Detection — Laravel-only mode
 * All environments use the Laravel API backend with MySQL.
 */

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

/** Running on localhost or private network IP */
export const IS_LOCAL_DEV =
  /^(localhost|127\.0\.0\.1)$/.test(hostname) ||
  /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

/** @deprecated — always false. Kept for backward compatibility. */
export const IS_LOVABLE = false;

/** Running on production (any non-local domain) */
export const IS_CPANEL = !IS_LOCAL_DEV && hostname !== '';
