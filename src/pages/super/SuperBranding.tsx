import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Palette, Save, Upload, X, Globe, Mail, Phone, MapPin, FileText, Building2 } from "lucide-react";
import { clearBrandingCache } from "@/lib/brandingHelper";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SuperBranding() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["super-general-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("general_settings").select("*").limit(1).maybeSingle();
      return data || {};
    },
  });

  const [form, setForm] = useState({
    site_name: "",
    address: "",
    email: "",
    mobile: "",
    support_email: "",
    support_phone: "",
    primary_color: "#2563eb",
    logo_url: "",
    login_logo_url: "",
    favicon_url: "",
  });

  // Footer/copyright from system_settings
  const { data: footerSettings } = useQuery({
    queryKey: ["super-footer-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("system_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["branding_footer_text", "branding_copyright_text"]);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value || ""; });
      return map;
    },
  });

  const [footerText, setFooterText] = useState("");
  const [copyrightText, setCopyrightText] = useState("");

  useEffect(() => {
    if (settings) {
      setForm({
        site_name: settings.site_name || "",
        address: settings.address || "",
        email: settings.email || "",
        mobile: settings.mobile || "",
        support_email: settings.support_email || "",
        support_phone: settings.support_phone || "",
        primary_color: settings.primary_color || "#2563eb",
        logo_url: settings.logo_url || "",
        login_logo_url: settings.login_logo_url || "",
        favicon_url: settings.favicon_url || "",
      });
    }
  }, [settings]);

  useEffect(() => {
    if (footerSettings) {
      setFooterText(footerSettings.branding_footer_text || "");
      setCopyrightText(footerSettings.branding_copyright_text || "");
    }
  }, [footerSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upsert general_settings
      if (settings?.id) {
        const { error } = await (supabase as any).from("general_settings").update({
          site_name: form.site_name,
          address: form.address,
          email: form.email,
          mobile: form.mobile,
          support_email: form.support_email,
          support_phone: form.support_phone,
          primary_color: form.primary_color,
          logo_url: form.logo_url || null,
          login_logo_url: form.login_logo_url || null,
          favicon_url: form.favicon_url || null,
          updated_at: new Date().toISOString(),
        }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("general_settings").insert({
          site_name: form.site_name,
          address: form.address,
          email: form.email,
          mobile: form.mobile,
          support_email: form.support_email,
          support_phone: form.support_phone,
          primary_color: form.primary_color,
          logo_url: form.logo_url || null,
          login_logo_url: form.login_logo_url || null,
          favicon_url: form.favicon_url || null,
        });
        if (error) throw error;
      }

      // Upsert footer/copyright in system_settings
      for (const [key, value] of [
        ["branding_footer_text", footerText],
        ["branding_copyright_text", copyrightText],
      ] as [string, string][]) {
        const { data: existing } = await (supabase as any)
          .from("system_settings")
          .select("id")
          .eq("setting_key", key)
          .maybeSingle();

        if (existing?.id) {
          await (supabase as any).from("system_settings").update({ setting_value: value }).eq("id", existing.id);
        } else {
          await (supabase as any).from("system_settings").insert({ setting_key: key, setting_value: value });
        }
      }

      clearBrandingCache();
    },
    onSuccess: () => {
      toast.success("Branding settings saved successfully!");
      qc.invalidateQueries({ queryKey: ["super-general-settings"] });
      qc.invalidateQueries({ queryKey: ["super-footer-settings"] });
    },
    onError: (e: any) => toast.error("Failed to save: " + e.message),
  });

  const [uploading, setUploading] = useState<string | null>(null);

  const handleLogoUpload = async (file: File, field: "logo_url" | "login_logo_url" | "favicon_url") => {
    setUploading(field);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `branding/${field}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setForm((prev) => ({ ...prev, [field]: urlData.publicUrl }));
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          Software Branding
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your software's branding — name, logo, contact info, and footer text. This applies across the entire platform.
        </p>
      </div>

      {/* Preview Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="h-12 w-auto object-contain rounded" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                {form.site_name?.charAt(0) || "S"}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold">{form.site_name || "Software Name"}</h2>
              <p className="text-xs text-muted-foreground">{form.address || "Your address here"}</p>
              <p className="text-xs text-muted-foreground">
                {[form.support_email || form.email, form.support_phone || form.mobile].filter(Boolean).join(" | ")}
              </p>
            </div>
          </div>
          {(footerText || copyrightText) && (
            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center">
              {footerText && <p>{footerText}</p>}
              {copyrightText && <p className="mt-0.5">{copyrightText}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {sa.basicInformation}
            </CardTitle>
            <CardDescription>Software name and identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{sa.softwareName} *</Label>
              <Input
                value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                placeholder="e.g. Smart ISP"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Address</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Your company address"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{sa.primaryColor}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <Input
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="flex-1"
                  placeholder="#2563eb"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" /> {sa.contactInformation}
            </CardTitle>
            <CardDescription>Support email, phone, and general contact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="info@yourdomain.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Mobile</Label>
              <Input
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="+8801XXXXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {sa.supportEmail}</Label>
              <Input
                type="email"
                value={form.support_email}
                onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                placeholder="support@yourdomain.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {sa.supportPhone}</Label>
              <Input
                value={form.support_phone}
                onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
                placeholder="+8801XXXXXXXXX"
              />
            </div>
          </CardContent>
        </Card>

        {/* Logo Uploads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" /> {sa.logoFavicon}
            </CardTitle>
            <CardDescription>Upload your software logo, login page logo, and favicon</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(["logo_url", "login_logo_url", "favicon_url"] as const).map((field) => {
              const labels: Record<string, string> = {
                logo_url: sa.mainLogo,
                login_logo_url: sa.loginPageLogo,
                favicon_url: sa.favicon,
              };
              return (
                <div key={field} className="space-y-2">
                  <Label>{labels[field]}</Label>
                  <div className="flex items-center gap-3">
                    {form[field] ? (
                      <div className="relative">
                        <img src={form[field]} alt={labels[field]} className="h-10 w-auto object-contain rounded border border-border" />
                        <button
                          type="button"
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                          onClick={() => setForm({ ...form, [field]: "" })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                        <Upload className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        value={form[field]}
                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                        placeholder="Paste image URL or upload"
                        className="text-sm"
                      />
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLogoUpload(f, field);
                        }}
                      />
                      <Button variant="outline" size="sm" asChild disabled={uploading === field}>
                        <span>
                          {uploading === field ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Footer & Copyright */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> {sa.footerCopyright}
            </CardTitle>
            <CardDescription>Text shown in invoice footers, PDF documents, and portal footer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{sa.footerText}</Label>
              <Textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g. Thank you for your business!"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Shown at the bottom of all invoices and PDF documents</p>
            </div>
            <div className="space-y-2">
              <Label>{sa.copyrightText}</Label>
              <Input
                value={copyrightText}
                onChange={(e) => setCopyrightText(e.target.value)}
                placeholder="e.g. © 2026 Smart ISP. All rights reserved."
              />
              <p className="text-xs text-muted-foreground">Shown in portal and document footers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Branding Settings
        </Button>
      </div>
    </div>
  );
}
