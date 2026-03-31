import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/db/client";
import { uploadCompanyLogo } from "@/lib/storage";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Save, Palette } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function GeneralSettings() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loginLogoFile, setLoginLogoFile] = useState<File | null>(null);
  const [loginLogoPreview, setLoginLogoPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    site_name: "",
    address: "",
    email: "",
    mobile: "",
    logo_url: "",
    primary_color: "#2563eb",
    login_logo_url: "",
    favicon_url: "",
    support_email: "",
    support_phone: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("general_settings").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      const s = settings as any;
      setForm({
        site_name: s.site_name || "",
        address: s.address || "",
        email: s.email || "",
        mobile: s.mobile || "",
        logo_url: s.logo_url || "",
        primary_color: s.primary_color || "#2563eb",
        login_logo_url: s.login_logo_url || "",
        favicon_url: s.favicon_url || "",
        support_email: s.support_email || "",
        support_phone: s.support_phone || "",
      });
      if (s.logo_url) setLogoPreview(s.logo_url);
      if (s.login_logo_url) setLoginLogoPreview(s.login_logo_url);
      if (s.favicon_url) setFaviconPreview(s.favicon_url);
    }
  }, [settings]);

  const handleFileChange = (setter: (f: File | null) => void, previewSetter: (s: string | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("File must be under 2MB"); return; }
    setter(file);
    previewSetter(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let logo_url = form.logo_url;
      let login_logo_url = form.login_logo_url;
      let favicon_url = form.favicon_url;
      const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (logoFile) logo_url = await uploadCompanyLogo(user.id, logoFile);
      if (loginLogoFile) login_logo_url = await uploadCompanyLogo(user.id + "-login", loginLogoFile);
      if (faviconFile) favicon_url = await uploadCompanyLogo(user.id + "-favicon", faviconFile);

      const { error } = await db
        .from("general_settings")
        .update({
          site_name: form.site_name,
          address: form.address,
          email: form.email,
          mobile: form.mobile,
          logo_url,
          primary_color: form.primary_color,
          login_logo_url,
          favicon_url,
          support_email: form.support_email,
          support_phone: form.support_phone,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", (settings as any)?.id);

      if (error) throw error;
      toast.success("Settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["general-settings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t.settings.general}</h1>
        <p className="text-muted-foreground mt-1">Configure system information and branding</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Site Name</Label>
              <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} placeholder="Smart ISP" />
            </div>
            <div className="space-y-1.5">
              <Label>Company Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main Street, Dhaka" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@smartisp.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile Number</Label>
                <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="+880 1234 567890" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Branding & White-Label</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Primary Brand Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="h-10 w-14 rounded border border-input cursor-pointer" />
                <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} placeholder="#2563eb" className="max-w-40" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Company Logo", preview: logoPreview, handler: handleFileChange(setLogoFile, setLogoPreview) },
                { label: "Login Page Logo", preview: loginLogoPreview, handler: handleFileChange(setLoginLogoFile, setLoginLogoPreview) },
                { label: "Favicon", preview: faviconPreview, handler: handleFileChange(setFaviconFile, setFaviconPreview) },
              ].map(({ label, preview, handler }) => (
                <div key={label} className="space-y-1.5">
                  <Label>{label}</Label>
                  <div className="flex flex-col items-center gap-2">
                    {preview && <img src={preview} alt={label} className="h-16 w-16 rounded-lg object-contain border border-border bg-muted" />}
                    <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent transition-colors">
                      <Upload className="h-4 w-4" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handler} />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Support Email</Label>
                <Input type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} placeholder="support@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Support Phone</Label>
                <Input value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} placeholder="+880 1234 567890" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
