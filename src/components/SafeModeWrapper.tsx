import { ReactNode } from "react";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import SafeMode from "@/pages/SafeMode";

interface SafeModeWrapperProps {
  children: ReactNode;
}

export default function SafeModeWrapper({ children }: SafeModeWrapperProps) {
  const { safeModeActive, error, dismissSafeMode } = useSystemHealth();
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();

  // Only show SafeMode to logged-in Super Admins when activated
  if (safeModeActive && user && isSuperAdmin) {
    return <SafeMode onDismiss={dismissSafeMode} errorMessage={error} />;
  }

  return <>{children}</>;
}
