import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db } from "@/integrations/supabase/client";
import bcrypt from "bcryptjs";

interface ResellerUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  tenant_id: string;
  wallet_balance: number;
}

interface ResellerAuthContextType {
  reseller: ResellerUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<ResellerUser>;
  signOut: () => Promise<void>;
}

const ResellerAuthContext = createContext<ResellerAuthContextType | undefined>(undefined);

export function ResellerAuthProvider({ children }: { children: ReactNode }) {
  const [reseller, setReseller] = useState<ResellerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const token = sessionStorage.getItem("reseller_token");
      const saved = sessionStorage.getItem("reseller_user");
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
          } else {
            sessionStorage.removeItem("reseller_token");
            sessionStorage.removeItem("reseller_user");
          }
        } catch {
          sessionStorage.removeItem("reseller_token");
          sessionStorage.removeItem("reseller_user");
        }
      }
      if (mounted) setLoading(false);
    };
    init();
    return () => { mounted = false; };
  }, []);

  const signIn = async (email: string, password: string): Promise<ResellerUser> => {
    const { data: resellerData, error } = await (db as any)
      .from("resellers")
      .select("*")
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();

    if (error || !resellerData) throw new Error("Invalid credentials or account suspended");

    const valid = resellerData.password_hash
      ? await bcrypt.compare(password, resellerData.password_hash)
      : false;
    if (!valid) throw new Error("Invalid credentials");

    const token = crypto.randomUUID();
    await (db as any).from("reseller_sessions").insert({
      reseller_id: resellerData.id,
      session_token: token,
      ip_address: "web",
      browser: navigator.userAgent.slice(0, 100),
      device_name: "Web Browser",
    });

    const user: ResellerUser = {
      id: resellerData.id,
      name: resellerData.name,
      email: resellerData.email || "",
      phone: resellerData.phone || "",
      company_name: resellerData.company_name || "",
      tenant_id: resellerData.tenant_id,
      wallet_balance: parseFloat(resellerData.wallet_balance) || 0,
    };

    sessionStorage.setItem("reseller_token", token);
    sessionStorage.setItem("reseller_user", JSON.stringify(user));
    setReseller(user);
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
    setReseller(null);
  };

  return (
    <ResellerAuthContext.Provider value={{ reseller, loading, signIn, signOut }}>
      {children}
    </ResellerAuthContext.Provider>
  );
}

export function useResellerAuth() {
  const ctx = useContext(ResellerAuthContext);
  if (!ctx) throw new Error("useResellerAuth must be used within ResellerAuthProvider");
  return ctx;
}
