import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  id: string;
  company_name: string;
  subdomain: string;
  contact_email: string | null;
  logo_url: string | null;
  status: string;
  max_customers: number;
  custom_domain: string | null;
  domain_verified: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  error: string | null;
  isPlatformAdmin: boolean;
  setTenantId: (id: string | null) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

/**
 * Extract subdomain from hostname.
 * Returns null for platform-level access (no subdomain or "www" or "admin")
 */
function extractSubdomain(): string | null {
  const hostname = window.location.hostname;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const params = new URLSearchParams(window.location.search);
    return params.get("tenant");
  }

  if (hostname.includes("lovable.app") || hostname.includes("lovable.dev")) {
    const params = new URLSearchParams(window.location.search);
    return params.get("tenant");
  }

  const parts = hostname.split(".");
  if (parts.length < 3) return null;

  const subdomain = parts[0];
  if (["www", "admin", "api", "app"].includes(subdomain)) return null;

  return subdomain;
}

/**
 * Get the full hostname for custom domain resolution.
 * Returns null on localhost/preview unless ?domain= is set.
 */
function getCustomDomainHost(): string | null {
  const hostname = window.location.hostname;

  // Dev/preview: allow ?domain= override for testing
  if (hostname === "localhost" || hostname === "127.0.0.1" ||
      hostname.includes("lovable.app") || hostname.includes("lovable.dev")) {
    const params = new URLSearchParams(window.location.search);
    return params.get("domain");
  }

  // In production, use the full hostname as potential custom domain
  return hostname;
}

function isSuperAdminRoute(): boolean {
  return window.location.pathname.startsWith("/super-admin");
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantId, setTenantIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const setTenantId = (id: string | null) => {
    setTenantIdState(id);
    if (!id) setTenant(null);
  };

  const setTenantFromData = (data: any) => {
    setTenant({
      id: data.id,
      company_name: data.company_name,
      subdomain: data.subdomain,
      contact_email: data.contact_email,
      logo_url: data.logo_url,
      status: data.status,
      max_customers: data.max_customers || 500,
      custom_domain: data.custom_domain || null,
      domain_verified: data.domain_verified || false,
    });
    setTenantIdState(data.id);
  };

  useEffect(() => {
    const resolve = async () => {
      try {
        if (isSuperAdminRoute()) {
          setIsPlatformAdmin(true);
          setLoading(false);
          return;
        }

        // Priority 1: Try custom domain resolution
        const customDomainHost = getCustomDomainHost();
        if (customDomainHost) {
          const { data, error: fetchError } = await supabase
            .from("tenants" as any)
            .select("*")
            .eq("custom_domain", customDomainHost)
            .eq("domain_verified", true)
            .eq("status", "active")
            .single();

          if (!fetchError && data) {
            setTenantFromData(data as any);
            setLoading(false);
            return;
          }
          // Not a custom domain match — fall through to subdomain
        }

        // Priority 2: Try subdomain resolution
        const subdomain = extractSubdomain();
        if (!subdomain) {
          setIsPlatformAdmin(true);
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("tenants" as any)
          .select("*")
          .eq("subdomain", subdomain)
          .eq("status", "active")
          .single();

        if (fetchError || !data) {
          setError(`Tenant "${subdomain}" not found or inactive.`);
          setLoading(false);
          return;
        }

        setTenantFromData(data as any);
        setLoading(false);
      } catch (err) {
        console.error("Tenant resolution failed:", err);
        setError("Failed to resolve tenant");
        setLoading(false);
      }
    };

    resolve();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, tenantId, loading, error, isPlatformAdmin, setTenantId }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used within TenantProvider");
  return context;
}
