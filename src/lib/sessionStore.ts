/**
 * Persistent storage for auth tokens.
 * Uses localStorage so sessions persist across tabs and page navigations.
 * Falls back gracefully if localStorage is unavailable.
 */

const store = typeof window !== 'undefined' ? window.localStorage : null;

export const sessionStore = {
  getItem(key: string): string | null {
    try { return store?.getItem(key) ?? null; } catch { return null; }
  },
  setItem(key: string, value: string): void {
    try { store?.setItem(key, value); } catch {}
  },
  removeItem(key: string): void {
    try { store?.removeItem(key); } catch {}
  },
};
