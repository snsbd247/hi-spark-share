import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Upload, Save } from "lucide-react";
import { toast } from "sonner";

export default function GeneralSettingsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    address: "",
    email: "",
    phone: "",
    logo_url: "",
  });

  const tenantId = user?.tenant_id;

  // Fetch tenant_company_info (tenant-specific branding for invoices/PDFs)
  const { data: companyInfo, isLoading } = useQuery({
    queryKey: ["tenant-company-info", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await (db as any)
        .from("tenant_company_info")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fallback: fetch tenant info to pre-populate if no tenant_company_info row exists
  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info-for-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await db.from("tenants")
        .select("name, email, phone, logo_url")
        .eq("id", tenantId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!tenantId && !companyInfo,
  });

  useEffect(() => {
    if (companyInfo) {
      setForm({
        company_name: companyInfo.company_name || "",
        address: companyInfo.address || "",
        email: companyInfo.email || "",
        phone: companyInfo.phone || "",
        logo_url: companyInfo.logo_url || "",
      });
      if (companyInfo.logo_url) setLogoPreview(companyInfo.logo_url);
    } else if (tenantInfo) {
      setForm({
        company_name: tenantInfo.name || "",
        address: (tenantInfo as any).address || "",
        email: tenantInfo.email || "",
        phone: tenantInfo.phone || "",
        logo_url: tenantInfo.logo_url || "",
      });
      if (tenantInfo.logo_url) setLogoPreview(tenantInfo.logo_url);
    }
  }, [companyInfo, tenantInfo]);

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
        try {
          const ext = logoFile.name.split(".").pop() || "png";
          const path = `tenant/${tenantId}/company-logo.${ext}`;
          const { error: uploadErr } = await db.storage
            .from("avatars")
            .upload(path, logoFile, { upsert: true });
          if (uploadErr) throw uploadErr;
          const { data: urlData } = db.storage.from("avatars").getPublicUrl(path);
          logo_url = urlData.publicUrl;
        } catch (uploadErr: any) {
          toast.error("Logo upload failed: " + (uploadErr?.message || "Unknown error"));
        }
      }

      const payload = {
        company_name: form.company_name,
        address: form.address,
        email: form.email,
        phone: form.phone,
        logo_url,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (companyInfo?.id) {
        ({ error } = await (db as any)
          .from("tenant_company_info")
          .update(payload)
          .eq("id", companyInfo.id));
      } else {
        ({ error } = await (db as any)
          .from("tenant_company_info")
          .insert({ ...payload, tenant_id: tenantId }));
      }

      if (error) throw error;
      toast.success("Company information saved");
      queryClient.invalidateQueries({ queryKey: ["tenant-company-info"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
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
        <CardDescription>This information is used in invoices, reports, and PDF documents only. System branding is managed by Super Admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Your Company Name" />
          </div>
          <div className="space-y-1.5">
            <Label>Company Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main Street, Dhaka" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+880 1234 567890" />
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
