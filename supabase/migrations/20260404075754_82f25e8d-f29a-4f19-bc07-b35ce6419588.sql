UPDATE public.customers SET tenant_id = 'b48f2347-3fc4-402c-87ef-7b977a64e075' WHERE customer_id LIKE 'SN-%' AND tenant_id IS NULL;
UPDATE public.customers SET tenant_id = 'd3a2ae80-298d-47a6-85cf-6d5adead05d1' WHERE customer_id LIKE 'NZ-%' AND tenant_id IS NULL;
UPDATE public.customers SET tenant_id = '64a1637e-3441-4de7-adeb-befdbd4e816f' WHERE customer_id LIKE 'FL-%' AND tenant_id IS NULL;