import { db } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════════
// Global Branding Helper — White-label SaaS branding system
// ═══════════════════════════════════════════════════════════════

export interface BrandingData {
  software_name: string;
  company_name: string;
  address: string;
  support_email: string;
  support_phone: string;
  logo_url: string | null;
  footer_text: string;
  copyright_text: string;
  email: string;
  mobile: string;
}

const DEFAULT_BRANDING: BrandingData = {
  software_name: "Smart ISP",
  company_name: "Smart ISP",
  address: "",
  support_email: "",
  support_phone: "",
  logo_url: null,
  footer_text: "Thank you for your business!",
  copyright_text: "",
  email: "",
  mobile: "",
};

let cachedBranding: BrandingData | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get branding from general_settings, with domain override support.
 * Falls back to default branding if unavailable.
 */
export async function getBranding(): Promise<BrandingData> {
  if (cachedBranding && Date.now() - cacheTime < CACHE_TTL) {
    return cachedBranding;
  }

  try {
    const { data } = await db.from("general_settings").select("*").limit(1).maybeSingle();
    
    if (data) {
      const d = data as any;
      cachedBranding = {
        software_name: d.site_name || DEFAULT_BRANDING.software_name,
        company_name: d.site_name || DEFAULT_BRANDING.company_name,
        address: d.address || DEFAULT_BRANDING.address,
        support_email: d.support_email || d.email || DEFAULT_BRANDING.support_email,
        support_phone: d.support_phone || d.mobile || DEFAULT_BRANDING.support_phone,
        logo_url: d.logo_url || DEFAULT_BRANDING.logo_url,
        footer_text: DEFAULT_BRANDING.footer_text,
        copyright_text: DEFAULT_BRANDING.copyright_text,
        email: d.email || DEFAULT_BRANDING.email,
        mobile: d.mobile || DEFAULT_BRANDING.mobile,
      };
    } else {
      cachedBranding = { ...DEFAULT_BRANDING };
    }

    cacheTime = Date.now();
    return cachedBranding;
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

/**
 * Get domain-specific branding override.
 * If current domain has a custom logo/company_name in domains table, use it.
 */
export async function getDomainBranding(): Promise<Partial<BrandingData>> {
  try {
    const currentDomain = window.location.hostname;
    const { data } = await (db as any)
      .from("domains")
      .select("domain, tenant_id")
      .eq("domain", currentDomain)
      .maybeSingle();

    if (data?.tenant_id) {
      // Get tenant info for domain-specific branding
      const { data: tenant } = await (db as any)
        .from("tenants")
        .select("name, logo_url")
        .eq("id", data.tenant_id)
        .maybeSingle();

      if (tenant) {
        return {
          company_name: tenant.name || undefined,
          logo_url: tenant.logo_url || undefined,
        };
      }
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Get final resolved branding — merges global + domain override.
 */
export async function getResolvedBranding(): Promise<BrandingData> {
  const base = await getBranding();
  const domainOverride = await getDomainBranding();

  return {
    ...base,
    ...(domainOverride.company_name ? { company_name: domainOverride.company_name } : {}),
    ...(domainOverride.logo_url ? { logo_url: domainOverride.logo_url } : {}),
  };
}

/** Clear the branding cache (call after settings update) */
export function clearBrandingCache() {
  cachedBranding = null;
  cacheTime = 0;
}
