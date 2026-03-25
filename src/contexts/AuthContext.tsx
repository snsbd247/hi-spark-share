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
    const token = localStorage.getItem("admin_token");
    const savedUser = localStorage.getItem("admin_user");

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      }
    }
    setLoading(false);
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

    if (edgeError || !edgeData?.email || !edgeData?.user_id) {
      throw new Error(edgeError?.message || edgeData?.error || "Login failed");
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: edgeData.email,
      password,
    });

    if (authError || !authData.session) {
      throw new Error(authError?.message || "Login failed");
    }

    const [{ data: roleData }, { data: profileData }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", edgeData.user_id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", edgeData.user_id)
        .maybeSingle(),
    ]);

    const adminUser: AdminUser = {
      id: edgeData.user_id,
      email: edgeData.email,
      name: profileData?.full_name || edgeData.email,
      role: roleData?.role || "staff",
      avatar_url: profileData?.avatar_url || undefined,
    };

    localStorage.setItem("admin_token", authData.session.access_token);
    localStorage.setItem("admin_user", JSON.stringify(adminUser));
    setUser(adminUser);

    return { user: adminUser, token: authData.session.access_token };
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
