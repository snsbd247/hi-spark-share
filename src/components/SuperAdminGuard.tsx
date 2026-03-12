import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function SuperAdminGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    const check = async () => {
      // Check platform_admins table
      const { data } = await supabase
        .from("platform_admins" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setIsAuthorized(true);
      } else {
        // Fallback: check user_roles for super_admin
        const { data: roles } = await supabase
          .from("user_roles" as any)
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "super_admin");
        setIsAuthorized((roles?.length ?? 0) > 0);
      }
      setChecking(false);
    };

    check();
  }, [user, authLoading]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/super-admin/login" replace />;
  if (!isAuthorized) return <Navigate to="/" replace />;

  return <>{children}</>;
}
