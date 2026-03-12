import { useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { setApiTenantId } from "@/lib/apiDb";

/**
 * Hook that syncs the current tenant context with the API proxy.
 * Place this in your root layout or App component.
 */
export function useTenantSync() {
  const { tenantId } = useTenant();

  useEffect(() => {
    setApiTenantId(tenantId);
  }, [tenantId]);

  return { tenantId };
}
