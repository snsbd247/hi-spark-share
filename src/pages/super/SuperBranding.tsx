import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Palette, Save, Upload, X, Globe, Mail, Phone, MapPin, FileText, Building2 } from "lucide-react";
import { clearBrandingCache } from "@/lib/brandingHelper";
import { useBranding } from "@/contexts/BrandingContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { IS_LOVABLE } from "@/lib/environment";
import { uploadFile } from "@/lib/storage";

export default function SuperBranding() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const { refresh: refreshBranding } = useBranding();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["super-general-settings"],
    queryFn: async () => {
      const { data, error } = await (db as any).from("general_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data || {};
    },
  });

  const [form, setForm] = useState({
    site_name: "", address: "", email: "", mobile: "",
    support_email: "", support_phone: "", primary_color: "#2563eb",
    logo_url: "", login_logo_url: "", favicon_url: "",
  });

  const { data: footerSettings } = useQuery({
    queryKey: ["super-footer-settings"],
    queryFn: async () => {
      const { data, error } = await (db as any)
        .from("system_settings").select("setting_key, setting_value")
        .in("setting_key", ["branding_footer_text", "branding_copyright_text"]);
      if (error) throw error;
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
        site_name: settings.site_name || "", address: settings.address || "",
        email: settings.email || "", mobile: settings.mobile || "",
        support_email: settings.support_email || "", support_phone: settings.support_phone || "",
        primary_color: settings.primary_color || "#2563eb",
        logo_url: settings.logo_url || "", login_logo_url: settings.login_logo_url || "",
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
      const brandingPayload = {
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
      };

      if (settings?.id) {
        const { error } = await (db as any).from("general_settings").update({
          ...brandingPayload,
          updated_at: new Date().toISOString(),
        }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await (db as any).from("general_settings").insert(brandingPayload);
        if (error) throw error;
      }

      await Promise.all(([
        ["branding_footer_text", footerText],
        ["branding_copyright_text", copyrightText],
      ] as [string, string][]).map(async ([key, value]) => {
        const { data: existing, error: existingError } = await (db as any)
          .from("system_settings")
          .select("id")
          .eq("setting_key", key)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing?.id) {
          const { error } = await (db as any)
            .from("system_settings")
            .update({ setting_value: value })
            .eq("id", existing.id);
          if (error) throw error;
          return;
        }

        const { error } = await (db as any)
          .from("system_settings")
          .insert({ setting_key: key, setting_value: value });
        if (error) throw error;
      }));

      clearBrandingCache();
    },
    onSuccess: () => {
      toast.success(sa.brandingSaved);
      qc.invalidateQueries({ queryKey: ["super-general-settings"] });
      qc.invalidateQueries({ queryKey: ["super-footer-settings"] });
      qc.invalidateQueries({ queryKey: ["landing-branding"] });
      refreshBranding();
    },
    onError: (e: any) => toast.error(sa.failedToSaveBranding + ": " + e.message),
  });

  const [uploading, setUploading] = useState<string | null>(null);

  const handleLogoUpload = async (file: File, field: "logo_url" | "login_logo_url" | "favicon_url") => {
    setUploading(field);
    try {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `branding/${field}-${Date.now()}.${ext}`;

      const publicUrl = IS_LOVABLE
        ? await (async () => {
            const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
            return urlData.publicUrl;
          })()
        : (await uploadFile("avatars", fileName, file, { upsert: true })).publicUrl;

      setForm((prev) => ({ ...prev, [field]: publicUrl }));
      toast.success(sa.imageUploaded);
    } catch (err: any) {
      toast.error(sa.uploadFailed + ": " + err.message);
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" /> {sa.softwareBranding}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{sa.brandingDesc}</p>
      </div>

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
              <h2 className="text-lg font-bold">{form.site_name || sa.softwareName}</h2>
              <p className="text-xs text-muted-foreground">{form.address || sa.address}</p>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> {sa.basicInformation}</CardTitle>
            <CardDescription>{sa.softwareNameIdentity}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{sa.softwareName} *</Label>
              <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {sa.address}</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>{sa.primaryColor}</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-10 h-10 rounded border border-border cursor-pointer" />
                <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="flex-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> {sa.contactInformation}</CardTitle>
            <CardDescription>{sa.contactDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {t.common.email}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {sa.mobile}</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {sa.supportEmail}</Label>
              <Input type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {sa.supportPhone}</Label>
              <Input value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> {sa.logoFavicon}</CardTitle>
            <CardDescription>{sa.logoDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(["logo_url", "login_logo_url", "favicon_url"] as const).map((field) => {
              const labels: Record<string, string> = { logo_url: sa.mainLogo, login_logo_url: sa.loginPageLogo, favicon_url: sa.favicon };
              return (
                <div key={field} className="space-y-2">
                  <Label>{labels[field]}</Label>
                  <div className="flex items-center gap-3">
                    {form[field] ? (
                      <div className="relative">
                        <img src={form[field]} alt={labels[field]} className="h-10 w-auto object-contain rounded border border-border" />
                        <button type="button" className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5" onClick={() => setForm({ ...form, [field]: "" })}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded border-2 border-dashed border-border flex items-center justify-center text-muted-foreground"><Upload className="h-4 w-4" /></div>
                    )}
                    <div className="flex-1">
                      <Input value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} placeholder={sa.pasteUrlOrUpload} className="text-sm" />
                    </div>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, field); }} />
                      <Button variant="outline" size="sm" asChild disabled={uploading === field}>
                        <span>{uploading === field ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}</span>
                      </Button>
                    </label>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {sa.footerCopyright}</CardTitle>
            <CardDescription>{sa.footerCopyrightDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{sa.footerText}</Label>
              <Textarea value={footerText} onChange={(e) => setFooterText(e.target.value)} rows={2} />
              <p className="text-xs text-muted-foreground">{sa.shownInInvoices}</p>
            </div>
            <div className="space-y-2">
              <Label>{sa.copyrightText}</Label>
              <Input value={copyrightText} onChange={(e) => setCopyrightText(e.target.value)} />
              <p className="text-xs text-muted-foreground">{sa.shownInPortal}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {sa.saveBrandingSettings}
        </Button>
      </div>
    </div>
  );
}
