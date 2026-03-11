import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import { renderFooterText, type FooterSettings } from "@/hooks/useFooterSettings";

export default function FooterSettingsTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    footer_text: "© {year} ISP Billing System. All Rights Reserved.",
    company_name: "ISP Billing System",
    footer_link: "",
    footer_developer: "",
    system_version: "1.0.0",
    auto_update_year: true,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["footer-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings" as any)
        .select("setting_key, setting_value")
        .in("setting_key", [
          "footer_text", "company_name", "footer_link",
          "footer_developer", "system_version", "auto_update_year",
        ]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data as any[])?.forEach((row: any) => { map[row.setting_key] = row.setting_value || ""; });
      return map;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        footer_text: settings.footer_text || form.footer_text,
        company_name: settings.company_name || form.company_name,
        footer_link: settings.footer_link || "",
        footer_developer: settings.footer_developer || "",
        system_version: settings.system_version || "",
        auto_update_year: settings.auto_update_year !== "false",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = [
        { key: "footer_text", value: form.footer_text },
        { key: "company_name", value: form.company_name },
        { key: "footer_link", value: form.footer_link },
        { key: "footer_developer", value: form.footer_developer },
        { key: "system_version", value: form.system_version },
        { key: "auto_update_year", value: form.auto_update_year ? "true" : "false" },
      ];
      for (const entry of entries) {
        const { error } = await (supabase as any)
          .from("system_settings")
          .update({ setting_value: entry.value, updated_at: new Date().toISOString() })
          .eq("setting_key", entry.key);
        if (error) throw error;
      }
      toast.success("Footer settings saved");
      queryClient.invalidateQueries({ queryKey: ["footer-settings"] });
      queryClient.invalidateQueries({ queryKey: ["footer-settings-admin"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const previewSettings: FooterSettings = { ...form };
  const previewText = renderFooterText(previewSettings);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Footer Content</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Footer Text</Label>
            <Textarea value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} placeholder="© {year} Company Name. All Rights Reserved." rows={2} />
            <p className="text-xs text-muted-foreground">Use {"{year}"} for auto year</p>
          </div>
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Developer Name</Label>
            <Input value={form.footer_developer} onChange={(e) => setForm({ ...form, footer_developer: e.target.value })} placeholder="e.g., Md Ismail Hosain" />
          </div>
          <div className="space-y-1.5">
            <Label>Developer Website URL</Label>
            <Input value={form.footer_link} onChange={(e) => setForm({ ...form, footer_link: e.target.value })} placeholder="https://example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>System Version</Label>
            <Input value={form.system_version} onChange={(e) => setForm({ ...form, system_version: e.target.value })} placeholder="1.0.0" />
          </div>
          <div className="flex items-center justify-between">
            <Label>Auto Update Copyright Year</Label>
            <Switch checked={form.auto_update_year} onCheckedChange={(v) => setForm({ ...form, auto_update_year: v })} />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Footer Preview</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
              <span>{previewText.replace(` Developed by ${form.footer_developer}.`, "")}
                {form.footer_developer && (
                  <>
                    {" Developed by "}
                    {form.footer_link ? (
                      <a href={form.footer_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{form.footer_developer}</a>
                    ) : (
                      form.footer_developer
                    )}
                    {"."}
                  </>
                )}
              </span>
              {form.system_version && <span className="opacity-60">v{form.system_version}</span>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">This footer appears at the bottom of the Admin Panel and Customer Portal.</p>
        </CardContent>
      </Card>
    </div>
  );
}
