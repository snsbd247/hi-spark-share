import api from "@/lib/api";
import { IS_LOVABLE } from "@/lib/environment";
import { supabaseDirect } from "@/integrations/supabase/client";

interface SyncCustomerPppoeOptions {
  customerId: string;
  pppoeUsername: string;
  pppoePassword?: string | null;
  profileName?: string | null;
  routerId?: string | null;
  oldPppoeUsername?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  isEdit?: boolean;
}

interface ToggleCustomerPppoeOptions {
  customerId: string;
  pppoeUsername: string;
  routerId: string;
}

export async function syncCustomerPppoe(options: SyncCustomerPppoeOptions) {
  const {
    customerId,
    pppoeUsername,
    pppoePassword,
    profileName,
    routerId,
    oldPppoeUsername,
    customerCode,
    customerName,
    isEdit = false,
  } = options;

  if (IS_LOVABLE) {
    const action = isEdit ? "update-pppoe" : "create-pppoe";
    const body = isEdit
      ? {
          customer_id: customerId,
          pppoe_username: pppoeUsername,
          pppoe_password: pppoePassword || undefined,
          profile_name: profileName || "default",
          old_pppoe_username: oldPppoeUsername || undefined,
          router_id: routerId || undefined,
        }
      : {
          customer_id: customerId,
          pppoe_username: pppoeUsername,
          pppoe_password: pppoePassword,
          profile_name: profileName || "default",
          comment: [customerCode, customerName].filter(Boolean).join(" - ") || undefined,
          router_id: routerId || undefined,
        };

    const { data, error } = await supabaseDirect.functions.invoke(`mikrotik-sync/${action}`, { body });
    if (error) throw error;
    return data;
  }

  const { data } = await api.post("/mikrotik/sync", { customer_id: customerId });
  return data;
}

export async function retryCustomerPppoeSync(customerId: string) {
  if (IS_LOVABLE) {
    const { data, error } = await supabaseDirect.functions.invoke("mikrotik-sync/retry-sync", {
      body: { customer_id: customerId },
    });
    if (error) throw error;
    return data;
  }

  const { data } = await api.post("/mikrotik/sync", { customer_id: customerId });
  return data;
}

export async function toggleCustomerPppoe(
  action: "disable-pppoe" | "enable-pppoe",
  options: ToggleCustomerPppoeOptions,
) {
  const body = {
    customer_id: options.customerId,
    pppoe_username: options.pppoeUsername,
    router_id: options.routerId,
  };

  if (IS_LOVABLE) {
    const { data, error } = await supabaseDirect.functions.invoke(`mikrotik-sync/${action}`, { body });
    if (error) throw error;
    return data;
  }

  const { data } = await api.post(`/mikrotik/${action}`, body);
  return data;
}

export async function removeCustomerPppoe(options: ToggleCustomerPppoeOptions) {
  const body = {
    customer_id: options.customerId,
    pppoe_username: options.pppoeUsername,
    router_id: options.routerId,
  };

  if (IS_LOVABLE) {
    const { data, error } = await supabaseDirect.functions.invoke("mikrotik-sync/remove-pppoe", { body });
    if (error) throw error;
    return data;
  }

  const { data } = await api.post("/mikrotik/remove-pppoe", body);
  return data;
}