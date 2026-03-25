import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";

export interface ModuleConfig {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const ALL_MODULES: ModuleConfig[] = [
  { key: "customers", label: "Customers", description: "Customer management & profiles", defaultEnabled: true },
  { key: "billing", label: "Billing", description: "Invoice generation & billing cycles", defaultEnabled: true },
  { key: "payments", label: "Payments", description: "Payment collection & tracking", defaultEnabled: true },
  { key: "merchant_payments", label: "Merchant Payments", description: "bKash/Nagad merchant payment matching", defaultEnabled: true },
  { key: "tickets", label: "Support Tickets", description: "Customer support ticket system", defaultEnabled: true },
  { key: "sms", label: "SMS & Reminders", description: "SMS notifications & bill reminders", defaultEnabled: true },
  { key: "accounting", label: "Accounting & Inventory", description: "Products, vendors, purchases, sales, expenses & reports", defaultEnabled: true },
  { key: "reports", label: "Reports", description: "Payment reports & analytics", defaultEnabled: true },
];

const SETTING_KEY = "enabled_modules";

export function useModuleSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["module-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();

      if (error || !data?.setting_value) {
        // Default: all enabled
        return ALL_MODULES.map(m => m.key);
      }

      try {
        return JSON.parse(data.setting_value) as string[];
      } catch {
        return ALL_MODULES.map(m => m.key);
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const enabledModules = data || ALL_MODULES.map(m => m.key);

  const isModuleEnabled = (moduleKey: string): boolean => {
    return enabledModules.includes(moduleKey);
  };

  const updateModules = useMutation({
    mutationFn: async (modules: string[]) => {
      // Check if setting exists
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({ setting_value: JSON.stringify(modules), updated_at: new Date().toISOString() })
          .eq("setting_key", SETTING_KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert({ setting_key: SETTING_KEY, setting_value: JSON.stringify(modules) });
        if (error) throw error;
      }
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
