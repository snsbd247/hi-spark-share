import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, Settings } from "lucide-react";

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
}

const DEFAULT_KEYS = [
  { key: "platform_name", label: "Platform Name", placeholder: "Smart ISP Platform" },
  { key: "support_email", label: "Support Email", placeholder: "support@example.com" },
  { key: "max_tenants", label: "Max Tenants", placeholder: "100" },
  { key: "maintenance_mode", label: "Maintenance Mode", placeholder: "false" },
];

export default function SuperAdminSystemSettings() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { isLoading } = useQuery({
    queryKey: ["sa-system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("*");
      if (error) throw error;
      const settings = (data || []) as SystemSetting[];
      const map: Record<string, string> = {};
      settings.forEach((s) => {
        map[s.setting_key] = s.setting_value || "";
      });
      setValues(map);
      return settings;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const def of DEFAULT_KEYS) {
        const val = values[def.key] || "";
        const { data: existing } = await supabase
          .from("system_settings")
          .select("id")
          .eq("setting_key", def.key)
          .maybeSingle();

        if (existing) {
          await supabase.from("system_settings").update({ setting_value: val }).eq("setting_key", def.key);
        } else {
          await supabase.from("system_settings").insert({ setting_key: def.key, setting_value: val });
        }
      }
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["sa-system-settings"] });
    },
    onError: () => toast.error("Failed to save settings"),
  });

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
          <p className="text-muted-foreground text-sm">Platform-wide configuration</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DEFAULT_KEYS.map((def) => (
            <div key={def.key} className="space-y-1">
              <Label>{def.label}</Label>
              <Input
                placeholder={def.placeholder}
                value={values[def.key] || ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [def.key]: e.target.value }))}
              />
            </div>
          ))}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
