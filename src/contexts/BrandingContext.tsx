import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db } from "@/integrations/supabase/client";
import { IS_LOVABLE, HAS_BACKEND } from "@/lib/environment";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

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

function normalizeHexColor(hex: string | null | undefined) {
  if (!hex) return null;

  const trimmed = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return null;
}

function getCachedPrimaryColor() {
  try {
    return normalizeHexColor(localStorage.getItem("branding_primary_color"));
  } catch {
    return null;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      let data: any = null;

      // On VPS, use direct public API to avoid super-admin proxy auth issues
      if (HAS_BACKEND && !IS_LOVABLE) {
        try {
          const res = await fetch(`${API_BASE_URL}/general_settings?per_page=1&paginate=false&_=${Date.now()}`, {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          });
          if (res.ok) {
            const json = await res.json();
            // paginate=false returns plain array [...], paginated returns {data: [...]}
            if (Array.isArray(json)) {
              data = json[0] || null;
            } else if (Array.isArray(json?.data)) {
              data = json.data[0] || null;
            } else {
              data = json?.data || json || null;
            }
          }
        } catch {
          // fallback to db
          const result = await db.from("general_settings").select("*").limit(1).maybeSingle();
          data = result?.data;
        }
      } else {
        const result = await db.from("general_settings").select("*").limit(1).maybeSingle();
        data = result?.data;
      }

      if (data) {
        const d = data as any;
        const primaryColor = normalizeHexColor(d.primary_color) || getCachedPrimaryColor() || "#2563eb";

        setBranding({
          site_name: d.site_name || "Smart ISP",
          logo_url: d.logo_url || null,
          login_logo_url: d.login_logo_url || null,
          favicon_url: d.favicon_url || null,
          primary_color: primaryColor,
          support_email: d.support_email || null,
          support_phone: d.support_phone || null,
          address: d.address || null,
          email: d.email || null,
          mobile: d.mobile || null,
        });

        applyPrimaryColor(primaryColor);
        try { localStorage.setItem("branding_primary_color", primaryColor); } catch {}

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
    const cachedColor = getCachedPrimaryColor();
    if (cachedColor) {
      applyPrimaryColor(cachedColor);
      setBranding((prev) => ({ ...prev, primary_color: cachedColor }));
    }

    if (!HAS_BACKEND && !IS_LOVABLE) {
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

export function applyPrimaryColor(hex: string) {
  const normalizedHex = normalizeHexColor(hex);
  if (!normalizedHex) return;

  const r = parseInt(normalizedHex.slice(1, 3), 16) / 255;
  const g = parseInt(normalizedHex.slice(3, 5), 16) / 255;
  const b = parseInt(normalizedHex.slice(5, 7), 16) / 255;

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

  // Light mode values
  const primary = `${hDeg} ${sPct}% ${lPct}%`;
  const accent = `${hDeg} ${clamp(sPct - 8, 32, 100)}% ${clamp(lPct - 8, 18, 58)}%`;
  const success = `${hDeg} ${clamp(sPct, 36, 100)}% ${clamp(lPct, 24, 60)}%`;
  const ring = primary;
  const sidebarPrimary = `${hDeg} ${clamp(sPct + 4, 40, 100)}% ${clamp(lPct + 6, 28, 68)}%`;
  const sidebarRing = primary;
  const gradientStart = `${hDeg} ${clamp(sPct, 36, 100)}% ${clamp(lPct - 10, 18, 58)}%`;
  const gradientEnd = `${hDeg} ${clamp(sPct + 4, 40, 100)}% ${clamp(lPct + 8, 28, 72)}%`;

  // Dark mode: slightly brighter
  const darkLPct = clamp(lPct + 12, 30, 60);
  const darkPrimary = `${hDeg} ${sPct}% ${darkLPct}%`;
  const darkAccent = `${hDeg} ${clamp(sPct - 8, 32, 100)}% ${clamp(darkLPct - 6, 24, 54)}%`;
  const darkSuccess = `${hDeg} ${clamp(sPct, 36, 100)}% ${darkLPct}%`;
  const darkSidebarPrimary = `${hDeg} ${clamp(sPct + 4, 40, 100)}% ${clamp(darkLPct + 6, 34, 68)}%`;
  const darkGradientStart = `${hDeg} ${clamp(sPct, 36, 100)}% ${darkLPct}%`;
  const darkGradientEnd = `${hDeg} ${clamp(sPct + 4, 40, 100)}% ${clamp(darkLPct + 8, 38, 72)}%`;

  // Inject a <style> tag to override both :root and .dark — beats @layer base specificity
  const STYLE_ID = "dynamic-primary-color";
  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    :root, html, :root.light, html.light {
      --primary: ${primary} !important;
      --accent: ${accent} !important;
      --success: ${success} !important;
      --ring: ${ring} !important;
      --sidebar-primary: ${sidebarPrimary} !important;
      --sidebar-ring: ${sidebarRing} !important;
      --gradient-start: ${gradientStart} !important;
      --gradient-end: ${gradientEnd} !important;
    }
    html.dark, :root.dark, .dark {
      --primary: ${darkPrimary} !important;
      --accent: ${darkAccent} !important;
      --success: ${darkSuccess} !important;
      --ring: ${darkPrimary} !important;
      --sidebar-primary: ${darkSidebarPrimary} !important;
      --sidebar-ring: ${darkPrimary} !important;
      --gradient-start: ${darkGradientStart} !important;
      --gradient-end: ${darkGradientEnd} !important;
    }
  `;

  // Also set inline styles as fallback
  const root = document.documentElement;
  root.style.setProperty("--primary", primary, "important");
  root.style.setProperty("--accent", accent, "important");
  root.style.setProperty("--success", success, "important");
  root.style.setProperty("--ring", ring, "important");
  root.style.setProperty("--sidebar-primary", sidebarPrimary, "important");
  root.style.setProperty("--sidebar-ring", sidebarRing, "important");
  root.style.setProperty("--gradient-start", gradientStart, "important");
  root.style.setProperty("--gradient-end", gradientEnd, "important");

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", normalizedHex);
  }
}
