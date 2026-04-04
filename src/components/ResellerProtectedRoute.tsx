import { Navigate } from "react-router-dom";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import { Loader2 } from "lucide-react";

export default function ResellerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { reseller, loading } = useResellerAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reseller) return <Navigate to="/reseller/login" replace />;

  return <>{children}</>;
}
