
ALTER TABLE public.customers ADD COLUMN router_id uuid REFERENCES public.mikrotik_routers(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN connection_status text NOT NULL DEFAULT 'active';
