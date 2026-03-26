import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPermission {
  module: string;
  action: string;
}

export function usePermissions() {
  const { user } = useAuth();
  const isSuperAdminFromAuth = user?.role === "super_admin";

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id, user?.role],
    queryFn: async () => {
      if (!user?.id) {
        return {
          permissions: [] as UserPermission[],
          isSuperAdmin: isSuperAdminFromAuth,
          customRoleName: isSuperAdminFromAuth ? "Super Admin" : "",
        };
      }

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role, custom_role_id")
        .eq("user_id", user.id);

      if (rolesError) {
        return {
          permissions: [] as UserPermission[],
          isSuperAdmin: isSuperAdminFromAuth,
          customRoleName: isSuperAdminFromAuth ? "Super Admin" : user.role || "",
        };
      }

      const isSuperAdmin = roles?.some((r: any) => r.role === "super_admin") || isSuperAdminFromAuth;

      if (isSuperAdmin) {
        return {
          permissions: [] as UserPermission[],
          isSuperAdmin: true,
          customRoleName: "Super Admin",
        };
      }

      const customRoleId = roles?.[0]?.custom_role_id;
      let customRoleName = roles?.[0]?.role || user.role || "";

      if (!customRoleId) {
        return { permissions: [] as UserPermission[], isSuperAdmin: false, customRoleName };
      }

      const { data: roleData } = await supabase
        .from("custom_roles")
        .select("name")
        .eq("id", customRoleId)
        .single();

      if (roleData) customRoleName = roleData.name;

      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", customRoleId);

      if (!rolePerms?.length) {
        return { permissions: [] as UserPermission[], isSuperAdmin: false, customRoleName };
      }

      const permIds = rolePerms.map((rp: any) => rp.permission_id);
      const { data: perms } = await supabase
        .from("permissions")
        .select("module, action")
        .in("id", permIds);

      return {
        permissions: (perms || []) as UserPermission[],
        isSuperAdmin: false,
        customRoleName,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const resolvedIsSuperAdmin = data?.isSuperAdmin || isSuperAdminFromAuth;

  const hasPermission = (module: string, action: string): boolean => {
    if (resolvedIsSuperAdmin) return true;
    return (data?.permissions || []).some((p) => p.module === module && p.action === action);
  };

  const hasModuleAccess = (module: string): boolean => {
    if (resolvedIsSuperAdmin) return true;
    return (data?.permissions || []).some((p) => p.module === module);
  };

  return {
    hasPermission,
    hasModuleAccess,
    isSuperAdmin: resolvedIsSuperAdmin,
    customRoleName: data?.customRoleName || (resolvedIsSuperAdmin ? "Super Admin" : ""),
    permissions: data?.permissions || [],
    isLoading,
  };
}
