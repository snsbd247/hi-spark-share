import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

interface TenantBranding {
  site_name: string;
  logo_url: string | null;
  login_logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  support_email: string | null;
  support_phone: string | null;
  address: string | null;
  email: string | null;
  mobile: string | null;
}

const defaultBranding: TenantBranding = {
  site_name: "Smart ISP",
  logo_url: null,
  login_logo_url: null,
  favicon_url: null,
  primary_color: "#2563eb",
  support_email: null,
  support_phone: null,
  address: null,
  email: null,
  mobile: null,
};

interface TenantBrandingContextType {
  branding: TenantBranding;
  loading: boolean;
}

const TenantBrandingContext = createContext<TenantBrandingContextType>({
  branding: defaultBranding,
  loading: true,
});

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useTenant();
  const [branding, setBranding] = useState<TenantBranding>(defaultBranding);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setBranding(defaultBranding);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const { data } = await supabase
          .from("general_settings" as any)
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (data) {
          const d = data as any;
          const b: TenantBranding = {
            site_name: d.site_name || "Smart ISP",
            logo_url: d.logo_url || null,
            login_logo_url: d.login_logo_url || null,
            favicon_url: d.favicon_url || null,
            primary_color: d.primary_color || "#2563eb",
            support_email: d.support_email || null,
            support_phone: d.support_phone || null,
            address: d.address || null,
            email: d.email || null,
            mobile: d.mobile || null,
          };
          setBranding(b);

          // Apply primary color dynamically
          if (d.primary_color && d.primary_color !== "#2563eb") {
            applyPrimaryColor(d.primary_color);
          }

          // Update favicon
          if (d.favicon_url) {
            const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (link) link.href = d.favicon_url;
          }

          // Update document title
          if (d.site_name) {
            document.title = d.site_name;
          }
        }
      } catch (err) {
        console.error("Failed to load tenant branding:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tenantId]);

  return (
    <TenantBrandingContext.Provider value={{ branding, loading }}>
      {children}
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding() {
  return useContext(TenantBrandingContext);
}

/**
 * Convert hex color to HSL and apply to CSS variables
 */
function applyPrimaryColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  const root = document.documentElement;
  root.style.setProperty("--primary", `${hDeg} ${sPct}% ${lPct}%`);
  root.style.setProperty("--ring", `${hDeg} ${sPct}% ${lPct}%`);
  root.style.setProperty("--sidebar-primary", `${hDeg} ${sPct}% ${lPct}%`);
  root.style.setProperty("--sidebar-ring", `${hDeg} ${sPct}% ${lPct}%`);
}
