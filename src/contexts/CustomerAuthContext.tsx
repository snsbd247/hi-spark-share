import { createContext, useContext, useState, ReactNode, useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface CustomerUser {
  id: string;
  customer_id: string;
  name: string;
  phone: string;
  area: string;
  road: string | null;
  house: string | null;
  city: string | null;
  email: string | null;
  package_id: string | null;
  monthly_bill: number;
  ip_address: string | null;
  pppoe_username: string | null;
  onu_mac: string | null;
  router_mac: string | null;
  installation_date: string | null;
  status: string;
  username: string | null;
}

interface CustomerAuthContextType {
  customer: CustomerUser | null;
  loading: boolean;
  signIn: (pppoeUsername: string, pppoePassword: string) => Promise<void>;
  signOut: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

const STORAGE_KEY = "customer_portal_session";

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCustomer(JSON.parse(saved));
      } catch {}
    }
    setLoading(false);
  }, []);

  const signIn = async (pppoeUsername: string, pppoePassword: string) => {
    // Use secure edge function — never query passwords client-side
    const res = await fetch(`${SUPABASE_URL}/functions/v1/customer-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pppoe_username: pppoeUsername, pppoe_password: pppoePassword }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Login failed");
    }

    const data = result.customer;
    const customerUser: CustomerUser = {
      id: data.id,
      customer_id: data.customer_id,
      name: data.name,
      phone: data.phone,
      area: data.area,
      road: data.road,
      house: data.house,
      city: data.city,
      email: data.email,
      package_id: data.package_id,
      monthly_bill: Number(data.monthly_bill),
      ip_address: data.ip_address,
      pppoe_username: data.pppoe_username,
      onu_mac: data.onu_mac,
      router_mac: data.router_mac,
      installation_date: data.installation_date,
      status: data.status,
      username: data.username,
    };

    setCustomer(customerUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customerUser));
  };

  const signOut = () => {
    setCustomer(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, signIn, signOut }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
};
