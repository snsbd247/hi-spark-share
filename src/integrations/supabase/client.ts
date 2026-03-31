/**
 * Database client — Dual-mode: Supabase SDK for Lovable preview, Laravel API for production.
 */
import { IS_LOVABLE } from '@/lib/environment';

let db: any;
let supabase: any;
let apiDb: any;

if (IS_LOVABLE) {
  // Use real Supabase SDK in Lovable preview
  const { createClient } = await import('@supabase/supabase-js');
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://udxrzqpivtzunnfenmyd.supabase.co";
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeHJ6cXBpdnR6dW5uZmVubXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjM3OTAsImV4cCI6MjA4ODUzOTc5MH0.cqupkjIjdIcF-g_WDBtmKpSXqMoL09TVPtWsV5XY0ps";
  
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);
  db = client;
  supabase = client;
  apiDb = client;
} else {
  // Use Laravel API wrapper in production
  const mod = await import('@/lib/apiDb');
  db = mod.db;
  supabase = mod.apiDb;
  apiDb = mod.apiDb;
}

export { apiDb, db, supabase };
export default apiDb;
