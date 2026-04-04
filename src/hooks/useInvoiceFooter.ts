import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export function useInvoiceFooter() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["invoice-footer-setting", tenantId],
    queryFn: async () => {
      let q = (db as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "invoice_footer");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q.maybeSingle();

      if (error) throw error;
      return (data as any)?.setting_value || "";
    },
    staleTime: 5 * 60 * 1000,
  });
}
