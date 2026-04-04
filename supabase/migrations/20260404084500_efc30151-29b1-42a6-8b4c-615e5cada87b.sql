
-- Add tenant_id to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON public.employees(tenant_id);

-- Add tenant_id to attendance
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON public.attendance(tenant_id);

-- Add tenant_id to salary_sheets
ALTER TABLE public.salary_sheets ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_salary_sheets_tenant ON public.salary_sheets(tenant_id);

-- Add tenant_id to loans
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_loans_tenant ON public.loans(tenant_id);

-- Add tenant_id to designations
ALTER TABLE public.designations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_designations_tenant ON public.designations(tenant_id);

-- Add tenant_id to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON public.suppliers(tenant_id);

-- Add tenant_id to supplier_payments
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_tenant ON public.supplier_payments(tenant_id);

-- Add tenant_id to packages
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_packages_tenant ON public.packages(tenant_id);

-- Add tenant_id to mikrotik_routers
ALTER TABLE public.mikrotik_routers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_mikrotik_routers_tenant ON public.mikrotik_routers(tenant_id);

-- Add tenant_id to ip_pools
ALTER TABLE public.ip_pools ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_ip_pools_tenant ON public.ip_pools(tenant_id);

-- Add tenant_id to categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON public.categories(tenant_id);

-- Add tenant_id to inventory_logs
ALTER TABLE public.inventory_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_tenant ON public.inventory_logs(tenant_id);

-- Add tenant_id to product_serials
ALTER TABLE public.product_serials ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_product_serials_tenant ON public.product_serials(tenant_id);

-- Add tenant_id to customer_devices
ALTER TABLE public.customer_devices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_customer_devices_tenant ON public.customer_devices(tenant_id);

-- Add tenant_id to expense_heads
ALTER TABLE public.expense_heads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_expense_heads_tenant ON public.expense_heads(tenant_id);

-- Add tenant_id to income_heads
ALTER TABLE public.income_heads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_income_heads_tenant ON public.income_heads(tenant_id);

-- Add tenant_id to employee_salary_structure
ALTER TABLE public.employee_salary_structure ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_employee_salary_structure_tenant ON public.employee_salary_structure(tenant_id);

-- Add tenant_id to employee_provident_fund
ALTER TABLE public.employee_provident_fund ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Add tenant_id to employee_savings_fund
ALTER TABLE public.employee_savings_fund ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
