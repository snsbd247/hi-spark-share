/**
 * Smart Supabase client — automatically switches between:
 * - Real Supabase client (Lovable preview / development)
 * - Laravel API wrapper (cPanel production when VITE_API_URL is set)
 *
 * All components should import from this file:
 *   import { supabase } from "@/integrations/supabase/client";
 */
import { supabaseRaw } from './rawClient';
import { apiDb } from '@/lib/apiDb';

const envApiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, "") || "";
const isEnvLocalhost = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(envApiBaseUrl);
const hasExplicitApiUrl = !!envApiBaseUrl && !isEnvLocalhost;

/**
 * When VITE_API_URL is set (cPanel production) → use Laravel API wrapper (no Supabase calls)
 * Otherwise (Lovable preview / local dev) → use real Supabase client
 */
export const supabase: any = hasExplicitApiUrl ? apiDb : supabaseRaw;
