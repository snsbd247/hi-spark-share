import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db, supabase } from "@/integrations/supabase/client";

interface ResellerUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  tenant_id: string;
  wallet_balance: number;
  user_id: string;
}

interface ResellerAuthContextType {
  reseller: ResellerUser | null;
  loading: boolean;
  impersonated: boolean;
  signIn: (userId: string, password: string) => Promise<ResellerUser>;
  signInAsImpersonation: (resellerId: string, adminToken: string) => Promise<ResellerUser>;
  signOut: () => Promise<void>;
}

const ResellerAuthContext = createContext<ResellerAuthContextType | undefined>(undefined);

export function ResellerAuthProvider({ children }: { children: ReactNode }) {
  const [reseller, setReseller] = useState<ResellerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonated, setImpersonated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const token = sessionStorage.getItem("reseller_token");
      const saved = sessionStorage.getItem("reseller_user");
      const isImpersonated = sessionStorage.getItem("reseller_impersonated") === "true";
      if (token && saved) {
        try {
          const parsed = JSON.parse(saved) as ResellerUser;
          const { data } = await (db as any)
            .from("reseller_sessions")
            .select("id")
            .eq("session_token", token)
            .eq("status", "active")
            .maybeSingle();
          if (data && mounted) {
            setReseller(parsed);
            setImpersonated(isImpersonated);
          } else {
            sessionStorage.removeItem("reseller_token");
            sessionStorage.removeItem("reseller_user");
            sessionStorage.removeItem("reseller_impersonated");
          }
        } catch {
          sessionStorage.removeItem("reseller_token");
          sessionStorage.removeItem("reseller_user");
          sessionStorage.removeItem("reseller_impersonated");
        }
      }
      if (mounted) setLoading(false);
    };
    init();
    return () => { mounted = false; };
  }, []);

  const signIn = async (userId: string, password: string): Promise<ResellerUser> => {
    const { data, error } = await supabase.functions.invoke("reseller-login", {
      body: { user_id: userId, password },
    });

    if (error) throw new Error(error.message || "Login failed");
    if (data?.error) throw new Error(data.error);
    if (!data?.user || !data?.token) throw new Error("Invalid response from server");

    const user: ResellerUser = data.user;
    sessionStorage.setItem("reseller_token", data.token);
    sessionStorage.setItem("reseller_user", JSON.stringify(user));
    sessionStorage.removeItem("reseller_impersonated");
    setReseller(user);
    setImpersonated(false);
    return user;
  };

  const signInAsImpersonation = async (resellerId: string, adminToken: string): Promise<ResellerUser> => {
    const { data, error } = await supabase.functions.invoke("reseller-impersonate", {
      body: { reseller_id: resellerId, admin_session_token: adminToken },
    });

    if (error) throw new Error(error.message || "Impersonation failed");
    if (data?.error) throw new Error(data.error);
    if (!data?.user || !data?.token) throw new Error("Invalid response from server");

    const user: ResellerUser = data.user;
    // Save admin token to restore later
    const existingAdminToken = sessionStorage.getItem("admin_token");
    if (existingAdminToken) {
      sessionStorage.setItem("saved_admin_token_for_reseller", existingAdminToken);
    }
    sessionStorage.setItem("reseller_token", data.token);
    sessionStorage.setItem("reseller_user", JSON.stringify(user));
    sessionStorage.setItem("reseller_impersonated", "true");
    setReseller(user);
    setImpersonated(true);
    return user;
  };

  const signOut = async () => {
    const token = sessionStorage.getItem("reseller_token");
    if (token) {
      await (db as any)
        .from("reseller_sessions")
        .update({ status: "expired" })
        .eq("session_token", token);
    }
    sessionStorage.removeItem("reseller_token");
    sessionStorage.removeItem("reseller_user");
    sessionStorage.removeItem("reseller_impersonated");
    setReseller(null);
    setImpersonated(false);
  };

  return (
    <ResellerAuthContext.Provider value={{ reseller, loading, impersonated, signIn, signInAsImpersonation, signOut }}>
      {children}
    </ResellerAuthContext.Provider>
  );
}

export function useResellerAuth() {
  const ctx = useContext(ResellerAuthContext);
  if (!ctx) throw new Error("useResellerAuth must be used within ResellerAuthProvider");
  return ctx;
}
