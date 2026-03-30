/**
 * Supabase-compatible client — always uses the Laravel API wrapper.
 * Provides the same query builder interface (from/select/insert/update/delete)
 * so all existing components work without modification.
 *
 * Import: import { supabase } from "@/integrations/supabase/client";
 */
import { apiDb } from '@/lib/apiDb';

export const supabase: any = apiDb;
