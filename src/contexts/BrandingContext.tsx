import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db } from "@/integrations/supabase/client";
import { IS_LOVABLE, HAS_BACKEND } from "@/lib/environment";

interface Branding {
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

const defaultBranding: Branding = {
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

interface BrandingContextType {
  branding: Branding;
  loading: boolean;
  refresh: () => void;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  loading: true,
  refresh: () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await db
        .from("general_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setBranding({
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
        });

        applyPrimaryColor(d.primary_color || "#2563eb");

        if (d.favicon_url) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) link.href = d.favicon_url;
        }
        if (d.site_name) {
          document.title = d.site_name;
        }
      }
    } catch (err) {
      console.warn("Branding: using defaults (backend unavailable)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!HAS_BACKEND && !IS_LOVABLE) {
      setLoading(false);
      return;
    }

    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    if (path.startsWith('/super')) {
      setLoading(false);
      return;
    }

    load();
  }, []);

  const refresh = () => {
    load();
  };

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

function applyPrimaryColor(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;

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
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const root = document.documentElement;
  root.style.setProperty("--primary", `${hDeg} ${sPct}% ${lPct}%`);
  root.style.setProperty("--accent", `${hDeg} ${clamp(sPct - 8, 32, 100)}% ${clamp(lPct - 8, 18, 58)}%`);
  root.style.setProperty("--success", `${hDeg} ${clamp(sPct, 36, 100)}% ${clamp(lPct, 24, 60)}%`);
  root.style.setProperty("--ring", `${hDeg} ${sPct}% ${lPct}%`);
  root.style.setProperty("--sidebar-primary", `${hDeg} ${clamp(sPct + 4, 40, 100)}% ${clamp(lPct + 6, 28, 68)}%`);
  root.style.setProperty("--sidebar-ring", `${hDeg} ${sPct}% ${lPct}%`);
  root.style.setProperty("--gradient-start", `${hDeg} ${clamp(sPct, 36, 100)}% ${clamp(lPct - 10, 18, 58)}%`);
  root.style.setProperty("--gradient-end", `${hDeg} ${clamp(sPct + 4, 40, 100)}% ${clamp(lPct + 8, 28, 72)}%`);
}
