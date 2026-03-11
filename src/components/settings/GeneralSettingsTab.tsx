import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { uploadCompanyLogo } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Save } from "lucide-react";
import { toast } from "sonner";

export default function GeneralSettingsTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    site_name: "",
    address: "",
    email: "",
    mobile: "",
    logo_url: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        site_name: settings.site_name || "",
        address: settings.address || "",
        email: settings.email || "",
        mobile: settings.mobile || "",
        logo_url: settings.logo_url || "",
      });
      if (settings.logo_url) setLogoPreview(settings.logo_url);
    }
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let logo_url = form.logo_url;
      if (logoFile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        logo_url = await uploadCompanyLogo(user.id, logoFile);
      }
      const { error } = await supabase
        .from("general_settings")
        .update({
          site_name: form.site_name,
          address: form.address,
          email: form.email,
          mobile: form.mobile,
          logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings?.id);
      if (error) throw error;
      toast.success("General settings saved");
      queryClient.invalidateQueries({ queryKey: ["general-settings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Company Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Site Name</Label>
            <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} placeholder="Smart ISP" />
          </div>
          <div className="space-y-1.5">
            <Label>Company Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main Street, Dhaka" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@smartisp.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="+880 1234 567890" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded-lg object-contain border border-border bg-muted" />
              )}
              <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent transition-colors">
                <Upload className="h-4 w-4" /> Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
