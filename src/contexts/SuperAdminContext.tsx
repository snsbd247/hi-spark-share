import { useState, createContext, useContext, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/lib/apiBaseUrl";
import { IS_LOVABLE } from "@/lib/environment";
import { supabase } from "@/integrations/supabase/client";
import { sessionStore } from "@/lib/sessionStore";
interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
}

interface SuperAdminContextType {
  user: SuperAdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const SuperAdminContext = createContext<SuperAdminContextType | null>(null);

export function SuperAdminProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SuperAdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = sessionStore.getItem("super_admin_token");
    const savedUser = sessionStore.getItem("super_admin_user");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        sessionStore.removeItem("super_admin_token");
        sessionStore.removeItem("super_admin_user");
      }
    }

    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const identifier = email.trim();

    if (!identifier) {
      throw new Error("Email or username is required");
    }

    let data: any;

    if (IS_LOVABLE) {
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("super-admin-login", {
          body: { email: identifier, password },
        });
        if (fnError) {
          // Edge function may return HTML instead of JSON on error
          const msg = typeof fnData === 'string' ? '' : (fnData?.error || '');
          const errMsg = msg || fnError.message || "";
          if (errMsg.includes("non-2xx") || errMsg.includes("FunctionsHttpError") || errMsg.includes("Unexpected token")) {
            throw new Error("Invalid username or password");
          }
          throw new Error(errMsg || "Login failed");
        }
        // Guard against HTML responses parsed as string
        if (!fnData || typeof fnData === 'string') {
          throw new Error("Invalid username or password");
        }
        if (fnData?.error) throw new Error(fnData.error);
        data = fnData;
      } catch (invokeErr: any) {
        if (invokeErr.message?.includes("Unexpected token") || invokeErr.message?.includes("not valid JSON")) {
          throw new Error("Login service unavailable. Please try again.");
        }
        throw invokeErr;
      }
    } else {
      const adminPath = import.meta.env.VITE_SUPER_ADMIN_PATH || "admin_login162";
      const res = await fetch(`${API_BASE_URL}/${adminPath}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const status = res.status;
        if (status === 401) throw new Error(errData.error || "Invalid username or password");
        if (status === 423) throw new Error(errData.error || "Account temporarily locked. Try again later.");
        throw new Error(errData.error || "Something went wrong. Please try again.");
      }
      data = await res.json();
    }

    setUser(data.user);
    setToken(data.token);
    sessionStore.setItem("super_admin_token", data.token);
    sessionStore.setItem("super_admin_user", JSON.stringify(data.user));
  };

  const logout = () => {
    if (token) {
      fetch(`${API_BASE_URL}/super-admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    sessionStore.removeItem("super_admin_token");
    sessionStore.removeItem("super_admin_user");
  };

  return (
    <SuperAdminContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  const ctx = useContext(SuperAdminContext);
  if (!ctx) throw new Error("useSuperAdmin must be used within SuperAdminProvider");
  return ctx;
}
