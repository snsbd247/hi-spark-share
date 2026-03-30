/**
 * Supabase-compatible client — Always uses Laravel API wrapper.
 * No Supabase dependency in production.
 */
import { apiDb } from '@/lib/apiDb';

export const supabase: any = apiDb;
