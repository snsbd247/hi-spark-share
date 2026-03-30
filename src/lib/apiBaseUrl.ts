/**
 * API Base URL — Auto-detect from current domain
 * Local dev → localhost:8000/api
 * Production → /api/api (relative, works on any domain)
 */
import { IS_LOCAL_DEV } from '@/lib/environment';

const LOCAL_API = 'http://localhost:8000/api';

export const API_BASE_URL = (() => {
  if (IS_LOCAL_DEV) return LOCAL_API;
  if (typeof window !== 'undefined') return `${window.location.origin}/api/api`;
  return LOCAL_API;
})();

export const API_PUBLIC_ROOT = API_BASE_URL.replace(/\/api$/, '');
