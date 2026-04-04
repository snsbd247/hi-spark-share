import { db } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════════
// Tenant Company Info — Used ONLY in invoices, reports, PDFs
// Separate from system branding (general_settings)
// ═══════════════════════════════════════════════════════════════

export interface TenantCompanyInfo {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
}

const DEFAULT_TENANT_INFO: TenantCompanyInfo = {
  company_name: "Smart ISP",
  address: "",
  phone: "",
  email: "",
  logo_url: "",
};

/**
 * Get tenant company info for use in invoices, reports, PDFs.
 * Falls back to general_settings if tenant_company_info doesn't exist yet.
 */
export async function getTenantCompanyInfo(tenantId?: string | null): Promise<TenantCompanyInfo> {
  try {
    // Try tenant_company_info first
    if (tenantId) {
      const { data } = await (db as any)
        .from("tenant_company_info")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (data) {
        return {
          company_name: data.company_name || DEFAULT_TENANT_INFO.company_name,
          address: data.address || DEFAULT_TENANT_INFO.address,
          phone: data.phone || DEFAULT_TENANT_INFO.phone,
          email: data.email || DEFAULT_TENANT_INFO.email,
          logo_url: data.logo_url || DEFAULT_TENANT_INFO.logo_url,
        };
      }
    }

    // Fallback: try general_settings (for backward compatibility)
    let query = db.from("general_settings").select("*");
    if (tenantId) query = (query as any).eq("tenant_id", tenantId);
    const { data: gs } = await query.limit(1).maybeSingle();
    if (gs) {
      return {
        company_name: gs.site_name || DEFAULT_TENANT_INFO.company_name,
        address: gs.address || DEFAULT_TENANT_INFO.address,
        phone: gs.mobile || DEFAULT_TENANT_INFO.phone,
        email: gs.email || DEFAULT_TENANT_INFO.email,
        logo_url: gs.logo_url || DEFAULT_TENANT_INFO.logo_url,
      };
    }

    return { ...DEFAULT_TENANT_INFO };
  } catch {
    return { ...DEFAULT_TENANT_INFO };
  }
}
