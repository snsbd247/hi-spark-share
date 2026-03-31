import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";

export function useInvoiceFooter() {
  return useQuery({
    queryKey: ["invoice-footer-setting"],
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "invoice_footer")
        .maybeSingle();

      if (error) throw error;
      return (data as any)?.setting_value || "";
    },
    staleTime: 5 * 60 * 1000,
  });
}
