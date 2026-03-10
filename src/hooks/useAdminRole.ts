import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAdminRole() {
  const { user } = useAuth();

  const { data: role } = useQuery({
    queryKey: ["admin-role", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .single();
      if (error) return "staff";
      return data?.role || "staff";
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["admin-profile-name", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  const canEdit = role === "admin" || role === "super_admin";
  const adminName = profile?.full_name || profile?.username || "Unknown";

  return { role, canEdit, adminName, userId: user?.id };
}
