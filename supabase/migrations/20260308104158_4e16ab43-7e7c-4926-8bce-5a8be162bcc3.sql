
-- SMS settings table
CREATE TABLE public.sms_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_token text,
  sender_id text DEFAULT 'SmartISP',
  sms_on_bill_generate boolean DEFAULT true,
  sms_on_payment boolean DEFAULT true,
  sms_on_registration boolean DEFAULT true,
  sms_on_suspension boolean DEFAULT true,
  whatsapp_token text,
  whatsapp_phone_id text,
  whatsapp_enabled boolean DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.sms_settings (id) VALUES (gen_random_uuid());

-- RLS for sms_settings
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sms settings"
  ON public.sms_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Add due_date and payment_link_token to bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_link_token text DEFAULT encode(gen_random_bytes(16), 'hex');

-- Reminder logs table
CREATE TABLE public.reminder_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id),
  phone text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  bill_id uuid REFERENCES public.bills(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reminder logs"
  ON public.reminder_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Allow anon to read bills by payment_link_token (for public payment page)
CREATE POLICY "Anon can read bills by token"
  ON public.bills FOR SELECT
  TO anon
  USING (true);
