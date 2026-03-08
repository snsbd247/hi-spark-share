
-- Fix 1: Remove overly permissive anon SELECT on customers (exposes passwords/PII)
DROP POLICY IF EXISTS "Anon can read customers by credentials" ON public.customers;

-- Fix 2: Tighten anon INSERT on support_tickets - require customer_id
DROP POLICY IF EXISTS "Anon can insert tickets" ON public.support_tickets;
CREATE POLICY "Anon can insert tickets" ON public.support_tickets
  FOR INSERT TO anon
  WITH CHECK (customer_id IS NOT NULL AND subject IS NOT NULL);

-- Fix 3: Tighten anon INSERT on ticket_replies - require ticket_id and message
DROP POLICY IF EXISTS "Anon can insert replies" ON public.ticket_replies;
CREATE POLICY "Anon can insert replies" ON public.ticket_replies
  FOR INSERT TO anon
  WITH CHECK (ticket_id IS NOT NULL AND message IS NOT NULL AND sender_name IS NOT NULL);
