import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface FooterSettings {
  footer_text: string;
  company_name: string;
  footer_link: string;
  footer_developer: string;
  system_version: string;
  auto_update_year: boolean;
  branding_copyright_text: string;
}

const DEFAULTS: FooterSettings = {
  footer_text: "© {year} ISP Billing System. All Rights Reserved.",
  company_name: "ISP Billing System",
  footer_link: "",
  footer_developer: "",
  system_version: "",
  auto_update_year: true,
  branding_copyright_text: "",
};

export function useFooterSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["footer-settings", tenantId],
    queryFn: async (): Promise<FooterSettings> => {
      let q = (db as any)
        .from("system_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "footer_text", "company_name", "footer_link",
          "footer_developer", "system_version", "auto_update_year",
          "branding_copyright_text",
        ]);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;

      const map: Record<string, string> = {};
      (data as any[])?.forEach((row: any) => {
        map[row.setting_key] = row.setting_value || "";
      });

      return {
        footer_text: map.footer_text || DEFAULTS.footer_text,
        company_name: map.company_name || DEFAULTS.company_name,
        footer_link: map.footer_link || DEFAULTS.footer_link,
        footer_developer: map.footer_developer || DEFAULTS.footer_developer,
        system_version: map.system_version || DEFAULTS.system_version,
        auto_update_year: map.auto_update_year !== "false",
        branding_copyright_text: map.branding_copyright_text || DEFAULTS.branding_copyright_text,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function renderFooterText(settings: FooterSettings): string {
  const year = settings.auto_update_year
    ? new Date().getFullYear().toString()
    : "";
  let text = settings.footer_text.replace("{year}", year);
  if (settings.footer_developer) {
    text += ` Developed by ${settings.footer_developer}.`;
  }
  return text;
}
