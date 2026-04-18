/**
 * API Base URL — Auto-detect per deployment target
 * Local dev → http://localhost:8000/api
 * VPS build → /api
 * cPanel build → /api/api
 */
import { IS_LOCAL_DEV } from '@/lib/environment';

const LOCAL_API = 'http://localhost:8000/api';
const IS_EXPLICIT_VPS = import.meta.env.VITE_DEPLOY_TARGET === 'vps';
const API_BASE_STORAGE_KEY = 'smartisp.api-base-path';

const normalizeApiPath = (value?: string | null) => {
  if (!value) return null;
  const normalized = `/${value}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized === '/api' || normalized === '/api/api' ? normalized : null;
};

const getStoredApiPath = () => {
  if (typeof window === 'undefined') return null;
  return normalizeApiPath(window.localStorage.getItem(API_BASE_STORAGE_KEY));
};

const getDefaultApiPath = () => (IS_EXPLICIT_VPS ? '/api' : '/api/api');

export const persistWorkingApiBaseUrl = (baseUrl: string) => {
  if (typeof window === 'undefined') return;

  const origin = window.location.origin;
  if (!baseUrl.startsWith(origin)) return;

  const apiPath = normalizeApiPath(baseUrl.slice(origin.length));
  if (apiPath) window.localStorage.setItem(API_BASE_STORAGE_KEY, apiPath);
};

export const API_BASE_URL = (() => {
  if (IS_LOCAL_DEV) return LOCAL_API;
  if (typeof window === 'undefined') return LOCAL_API;

  const apiPath =
    getStoredApiPath() ??
    normalizeApiPath(import.meta.env.VITE_API_BASE_PATH) ??
    getDefaultApiPath();
  return `${window.location.origin}${apiPath}`;
})();

export const getAlternateApiBaseUrl = (currentBaseUrl = API_BASE_URL) => {
  if (typeof window === 'undefined') return null;

  const origin = window.location.origin;
  if (!currentBaseUrl.startsWith(origin)) return null;

  const apiPath = normalizeApiPath(currentBaseUrl.slice(origin.length));
  if (apiPath === '/api/api') return `${origin}/api`;
  if (apiPath === '/api') return `${origin}/api/api`;
  return null;
};

export const API_PUBLIC_ROOT = API_BASE_URL.replace(/\/api$/, '');
