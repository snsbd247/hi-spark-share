import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { IS_LOVABLE } from "@/lib/environment";
import { supabaseDirect } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/client";
import api from "@/lib/api";
import { sessionStore } from "@/lib/sessionStore";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string;
  tenant_id?: string;
  must_change_password?: boolean;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: AdminUser; token: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // Skip session validation on public pages (no admin context needed)
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const publicPaths = ['/', '/landing', '/demo-request', '/admin/login', '/admin/forgot-password', '/reset-password', '/portal/login', '/reseller/login', '/super/login', '/pay'];
      if (publicPaths.includes(path)) {
        if (mounted) setLoading(false);
        return;
      }

      const token = sessionStore.getItem("admin_token");
      const savedUser = sessionStore.getItem("admin_user");
      if (token && savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser) as AdminUser;

          if (IS_LOVABLE) {
            // Validate session via Supabase direct query
            const { data, error } = await db
              .from("admin_sessions")
              .select("id")
              .eq("session_token", token)
              .eq("status", "active")
              .maybeSingle();
            if (data && !error && mounted) {
              setUser(parsedUser);
            } else {
              sessionStore.removeItem("admin_token");
              sessionStore.removeItem("admin_user");
            }
          } else {
            try {
              const { data } = await api.get("/admin/me");
              if (data?.id && mounted) {
                // Sync tenant_id from server (may be missing in old stored sessions)
                if (data.tenant_id && !parsedUser.tenant_id) {
                  parsedUser.tenant_id = data.tenant_id;
                  sessionStore.setItem("admin_user", JSON.stringify(parsedUser));
                }
                setUser(parsedUser);
              } else {
                sessionStore.removeItem("admin_token");
                sessionStore.removeItem("admin_user");
              }
            } catch {
              sessionStore.removeItem("admin_token");
              sessionStore.removeItem("admin_user");
            }
          }
        } catch {
          sessionStore.removeItem("admin_token");
          sessionStore.removeItem("admin_user");
        }
      }
      if (mounted) setLoading(false);
    };

    initializeAuth();
    return () => { mounted = false; };
  }, []);

  const signIn = async (username: string, password: string) => {
    if (IS_LOVABLE) {
      const { data, error } = await supabaseDirect.functions.invoke("admin-login", {
        body: { username, password },
      });
      // Extract user-friendly error from edge function response
      if (error) {
        const msg = data?.error || error.message || "";
        if (msg.includes("non-2xx") || msg.includes("FunctionsHttpError")) {
          throw new Error("Invalid username or password");
        }
        throw new Error(msg || "Login failed");
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.user || !data?.token) throw new Error("Invalid username or password");
      const adminUser: AdminUser = data.user;
      sessionStore.setItem("admin_token", data.token);
      sessionStore.setItem("admin_user", JSON.stringify(adminUser));
      setUser(adminUser);
      return { user: adminUser, token: data.token };
    } else {
      try {
        const { data } = await api.post("/admin/login", { email: username, password });
        if (!data?.user || !data?.token) throw new Error(data?.error || "Invalid username or password");
        const adminUser: AdminUser = data.user;
        sessionStore.setItem("admin_token", data.token);
        sessionStore.setItem("admin_user", JSON.stringify(adminUser));
        setUser(adminUser);
        return { user: adminUser, token: data.token };
      } catch (err: any) {
        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
        if (status === 401) throw new Error(serverMsg || "Invalid username or password");
        if (status === 403) throw new Error(serverMsg || "Account is disabled");
        throw new Error(serverMsg || "Something went wrong. Please try again.");
      }
    }
  };

  const signOut = async () => {
    if (IS_LOVABLE) {
      const token = sessionStore.getItem("admin_token");
      if (token) {
        try {
          await db
            .from("admin_sessions")
            .update({ status: "expired" })
            .eq("session_token", token);
        } catch {}
      }
    } else {
      try { await api.post("/admin/logout"); } catch {}
    }
    sessionStore.removeItem("admin_token");
    sessionStore.removeItem("admin_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

const fallbackAuth: AuthContextType = {
  user: null,
  loading: true,
  signIn: async () => { throw new Error("AuthProvider not mounted"); },
  signOut: async () => {},
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context ?? fallbackAuth;
};
