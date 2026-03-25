import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "@/lib/api";
import { IS_LOVABLE_RUNTIME } from "@/lib/apiBaseUrl";
import { supabase } from "@/integrations/supabase/client";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string;
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
      const token = localStorage.getItem("admin_token");
      const savedUser = localStorage.getItem("admin_user");

      const clearLocalAuth = () => {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      };

      if (token && savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser) as AdminUser;

          if (IS_LOVABLE_RUNTIME && token.split(".").length === 3) {
            const { data: sessionData, error } = await supabase.auth.getSession();
            const sessionToken = sessionData?.session?.access_token;

            if (error?.code === "refresh_token_not_found" || !sessionToken) {
              clearLocalAuth();
              await supabase.auth.signOut({ scope: "local" }).catch(() => {});
            } else {
              localStorage.setItem("admin_token", sessionToken);
              if (mounted) setUser(parsedUser);
            }
          } else if (mounted) {
            setUser(parsedUser);
          }
        } catch {
          clearLocalAuth();
          if (IS_LOVABLE_RUNTIME) {
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          }
        }
      }

      if (mounted) setLoading(false);
    };

    initializeAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    // Try Laravel API first
    let apiSuccess = false;
    try {
      const { data } = await api.post("/admin/login", { email: username, password });
      if (data?.user && data?.token) {
        const adminUser: AdminUser = data.user;
        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("admin_user", JSON.stringify(adminUser));
        setUser(adminUser);
        apiSuccess = true;
        return { user: adminUser, token: data.token };
      }
    } catch {
      // API failed — will try Supabase fallback below
    }

    if (apiSuccess) return { user: null as any, token: "" };

    // Supabase Edge Function fallback
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke("admin-login", {
      body: { username, password },
    });

    if (edgeError || !edgeData?.success) {
      throw new Error(edgeData?.error || edgeError?.message || "Login failed");
    }

    const adminUser: AdminUser = edgeData.user;

    localStorage.setItem("admin_token", edgeData.token);
    localStorage.setItem("admin_user", JSON.stringify(adminUser));
    setUser(adminUser);

    return { user: adminUser, token: edgeData.token };
  };

  const signOut = async () => {
    try {
      await api.post("/admin/logout");
    } catch {
      // Ignore errors on logout
    }

    if (IS_LOVABLE_RUNTIME) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore errors on fallback signout
      }
    }

    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
