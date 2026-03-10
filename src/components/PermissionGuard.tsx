import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

interface PermissionGuardProps {
  children: ReactNode;
  module: string;
  action?: string;
  fallback?: ReactNode;
}

export default function PermissionGuard({ children, module, action = "view", fallback }: PermissionGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, isLoading, isSuperAdmin } = usePermissions();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;

  if (isSuperAdmin || hasPermission(module, action)) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  return <Navigate to="/" replace />;
}
