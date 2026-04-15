
-- Attach audit trigger to key tables
CREATE OR REPLACE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_bills AFTER INSERT OR UPDATE OR DELETE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_packages AFTER INSERT OR UPDATE OR DELETE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_resellers AFTER INSERT OR UPDATE OR DELETE ON public.resellers FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_general_settings AFTER INSERT OR UPDATE OR DELETE ON public.general_settings FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_system_settings AFTER INSERT OR UPDATE OR DELETE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_custom_roles AFTER INSERT OR UPDATE OR DELETE ON public.custom_roles FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_mikrotik_routers AFTER INSERT OR UPDATE OR DELETE ON public.mikrotik_routers FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE OR REPLACE TRIGGER audit_tenants AFTER INSERT OR UPDATE OR DELETE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
