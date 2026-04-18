import { IS_LOVABLE } from "@/lib/environment";
import { db } from "@/integrations/supabase/client";
import api from "@/lib/api";

/**
 * Tenant admin impersonates a customer — generates a portal session token,
 * then opens the customer portal in a NEW TAB so the admin's own session stays intact.
 */
export async function impersonateCustomerPortal(customerId: string): Promise<void> {
  let sessionToken: string | undefined;
  let expiresAt: string | undefined;

  if (IS_LOVABLE) {
    // Lovable preview: directly create session row (admin is already authenticated in this context)
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h
    const token = (crypto.randomUUID as any)?.() || `imp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { error } = await (db as any).from("customer_sessions").insert({
      customer_id: customerId,
      session_token: token,
      expires_at: expires.toISOString(),
    });
    if (error) throw new Error(error.message || "Failed to create portal session");
    sessionToken = token;
    expiresAt = expires.toISOString();
  } else {
    const { data } = await api.post(`/customers/${customerId}/impersonate`);
    sessionToken = data.session_token;
    expiresAt = data.expires_at;
  }

  if (!sessionToken) throw new Error("No session token returned");

  // Open portal in a new tab carrying the impersonation token via URL hash (not stored in history)
  const portalUrl = `${window.location.origin}/portal/login#impersonate=${encodeURIComponent(sessionToken)}&expires=${encodeURIComponent(expiresAt || "")}`;
  window.open(portalUrl, "_blank", "noopener,noreferrer");
}
