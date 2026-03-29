import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ModuleConfig {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const ALL_MODULES: ModuleConfig[] = [
  { key: "customers", label: "Customer Management", description: "Customer profiles, connection status, due tracking & filtering", defaultEnabled: true },
  { key: "billing", label: "Billing", description: "Monthly bill generation, billing cycles & invoice management", defaultEnabled: true },
  { key: "payments", label: "Payments", description: "Payment collection, tracking & receipts", defaultEnabled: true },
  { key: "merchant_payments", label: "Merchant Payments", description: "bKash/Nagad merchant payment auto-matching & reconciliation", defaultEnabled: true },
  { key: "tickets", label: "Support Tickets", description: "Customer support ticket system with replies & tracking", defaultEnabled: true },
  { key: "sms", label: "SMS & Reminders", description: "SMS notifications, bill reminders & WhatsApp integration", defaultEnabled: true },
  { key: "accounting", label: "Accounting", description: "Chart of accounts, journal entries, trial balance, profit & loss, balance sheet", defaultEnabled: true },
  { key: "inventory", label: "Inventory & Sales", description: "Product management, stock tracking, sales & invoicing", defaultEnabled: true },
  { key: "hr", label: "Human Resource (HR)", description: "Employee management, attendance, salary sheets, loans & provident fund", defaultEnabled: true },
  { key: "supplier", label: "Supplier Management", description: "Supplier profiles, purchase orders & supplier payments", defaultEnabled: true },
  { key: "reports", label: "Reports & Analytics", description: "Daily, financial, BTRC, sales & traffic reports", defaultEnabled: true },
  { key: "users", label: "User Management", description: "Admin user accounts, roles assignment & access control", defaultEnabled: true },
  { key: "roles", label: "Roles & Permissions", description: "Create roles with granular per-module permissions (View/Create/Edit/Delete)", defaultEnabled: true },
  { key: "settings", label: "System Settings", description: "General settings, packages, zones, MikroTik, integrations, backup & API health", defaultEnabled: true },
];

const SETTING_KEY = "enabled_modules";

export function useModuleSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["module-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();

      if (error || !data?.setting_value) {
        return ALL_MODULES.map((m) => m.key);
      }

      try {
        return JSON.parse(data.setting_value) as string[];
      } catch {
        return ALL_MODULES.map((m) => m.key);
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const enabledModules = Array.isArray(data) ? data : ALL_MODULES.map((m) => m.key);

  const isModuleEnabled = (moduleKey: string): boolean => {
    return enabledModules.includes(moduleKey);
  };

  const updateModules = useMutation({
    mutationFn: async (modules: string[]) => {
      const { error } = await (supabase as any)
        .from("system_settings")
        .upsert(
          [{
            setting_key: SETTING_KEY,
            setting_value: JSON.stringify(modules),
            updated_at: new Date().toISOString(),
          }],
          { onConflict: "setting_key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-settings"] });
    },
  });

  return {
    enabledModules,
    isModuleEnabled,
    updateModules,
    isLoading,
    allModules: ALL_MODULES,
  };
}
