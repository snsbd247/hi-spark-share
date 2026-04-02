import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import api from "@/lib/api";
import { toast } from "sonner";

// Cache for integration settings with TTL
const settingsCache: Record<string, { data: any; expiresAt: number }> = {};
const CACHE_TTL_MS = 60_000; // 1 minute

export function useSmtpSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["integration-smtp"],
    staleTime: 60_000,
    queryFn: async () => {
      const cached = settingsCache["smtp"];
      if (cached && cached.expiresAt > Date.now()) return cached.data;

      const { data, error } = await db
        .from("system_settings")
        .select("setting_key, setting_value")
        .like("setting_key", "smtp_%");
      if (error) throw error;

      const result: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        result[row.setting_key] = row.setting_value || "";
      });
      settingsCache["smtp"] = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
      return result;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      for (const [key, value] of Object.entries(values)) {
        const { data: existing } = await db
          .from("system_settings")
          .select("id")
          .eq("setting_key", key)
          .maybeSingle();

        if (existing) {
          const { error } = await db
            .from("system_settings")
            .update({ setting_value: value, updated_at: new Date().toISOString() })
            .eq("setting_key", key);
          if (error) throw error;
        } else {
          const { error } = await db
            .from("system_settings")
            .insert({ setting_key: key, setting_value: value });
          if (error) throw error;
        }
      }
      delete settingsCache["smtp"];
    },
    onSuccess: () => {
      toast.success("SMTP settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-smtp"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: async (testEmail: string) => {
      const { data } = await api.post('/email/send', {
        to: testEmail,
        subject: "Smart ISP - SMTP Test Email",
        body: `<div style="font-family:Arial,sans-serif;padding:20px"><h2>✅ SMTP Test Successful</h2><p>This is a test email from your Smart ISP admin panel.</p><p>If you received this email, your SMTP configuration is working correctly.</p><p style="color:#666;font-size:12px">Sent at: ${new Date().toLocaleString()}</p></div>`,
      });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("Test email sent successfully!"),
    onError: (err: any) => toast.error(`SMTP test failed: ${err.message}`),
  });

  return { settings, isLoading, saveMutation, testMutation };
}

export function useSmsTestSend() {
  return useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      const { data, error } = await db.functions.invoke("send-sms", {
        body: { to: phone, message, sms_type: "test" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data && data.success === false) {
        throw new Error(data.error || data.response || "SMS delivery failed");
      }
      return data;
    },
    onSuccess: () => toast.success("Test SMS sent successfully!"),
    onError: (err: any) => toast.error(`SMS test failed: ${err.message}`),
  });
}

export function useBkashTest() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await db.functions.invoke("bkash-payment", {
        body: { action: "test_connection" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("bKash API connection successful!"),
    onError: (err: any) => toast.error(`bKash test failed: ${err.message}`),
  });
}

export function useNagadTest() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/nagad/create-payment', { action: "test_connection" });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("Nagad API connection successful!"),
    onError: (err: any) => toast.error(`Nagad test failed: ${err.message}`),
  });
}
