
-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product Serials table
CREATE TABLE IF NOT EXISTS public.product_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_serial UNIQUE (serial_number)
);
ALTER TABLE public.product_serials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.product_serials FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.product_serials FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Customer Devices table
CREATE TABLE IF NOT EXISTS public.customer_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid,
  serial_number text,
  mac_address text,
  ip_address text,
  assigned_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.customer_devices FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.customer_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory Logs table
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid,
  type text NOT NULL DEFAULT 'in',
  quantity integer NOT NULL DEFAULT 0,
  note text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_access" ON public.inventory_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON public.inventory_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add category_id and brand/model columns to products if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
    ALTER TABLE public.products ADD COLUMN category_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand') THEN
    ALTER TABLE public.products ADD COLUMN brand text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='model') THEN
    ALTER TABLE public.products ADD COLUMN model text;
  END IF;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_product_serials_product ON public.product_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_status ON public.product_serials(status);
CREATE INDEX IF NOT EXISTS idx_customer_devices_customer ON public.customer_devices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_devices_status ON public.customer_devices(status);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON public.inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_type ON public.inventory_logs(type);
CREATE INDEX IF NOT EXISTS idx_categories_status ON public.categories(status);
