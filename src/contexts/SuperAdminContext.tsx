import { useState, createContext, useContext, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

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
    const savedToken = localStorage.getItem("super_admin_token");
    const savedUser = localStorage.getItem("super_admin_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const adminPath = import.meta.env.VITE_SUPER_ADMIN_PATH || "admin_login162";
    const base = API_BASE_URL;
    const res = await fetch(`${base}/${adminPath}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login failed");
    }

    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("super_admin_token", data.token);
    localStorage.setItem("super_admin_user", JSON.stringify(data.user));
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
    localStorage.removeItem("super_admin_token");
    localStorage.removeItem("super_admin_user");
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
