CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON public.contact_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read" ON public.contact_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated update" ON public.contact_messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);