import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wifi, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { db } from "@/integrations/supabase/client";

export default function CustomerLogin() {
  const { t } = useLanguage();
  const [pppoeUsername, setPppoeUsername] = useState("");
  const [pppoePassword, setPppoePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const { signIn } = useCustomerAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  // ── Impersonation: tenant admin opened this tab with a pre-issued session_token ──
  useEffect(() => {
    const hash = window.location.hash || "";
    if (!hash.includes("impersonate=")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const token = params.get("impersonate");
    const expires = params.get("expires");
    if (!token) return;

    setImpersonating(true);
    (async () => {
      try {
        const { data: session } = await (db as any)
          .from("customer_sessions")
          .select("customer_id, expires_at")
          .eq("session_token", token)
          .maybeSingle();
        if (!session?.customer_id) throw new Error("Impersonation session invalid or expired");

        const { data: customer } = await (db as any)
          .from("customers")
          .select("id, customer_id, name, phone, area, status, monthly_bill, package_id, photo_url, tenant_id")
          .eq("id", session.customer_id)
          .maybeSingle();
        if (!customer) throw new Error("Customer not found");

        const portalSession = {
          ...customer,
          monthly_bill: Number(customer.monthly_bill || 0),
          session_token: token,
          expires_at: expires || session.expires_at,
        };
        localStorage.setItem("customer_portal_session", JSON.stringify(portalSession));
        window.history.replaceState(null, "", window.location.pathname);
        toast.success(`Impersonating ${customer.name}`);
        window.location.href = "/portal";
      } catch (err: any) {
        toast.error(err?.message || "Impersonation failed");
        setImpersonating(false);
      }
    })();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pppoeUsername.trim() || !pppoePassword.trim()) {
      toast.error(t.portal.loginSubtitle);
      return;
    }
    setLoading(true);
    try {
      await signIn(pppoeUsername.trim(), pppoePassword.trim());
      navigate("/portal");
      toast.success(t.portal.welcome + "!");
    } catch (error: any) {
      toast.error(error.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = branding.login_logo_url || branding.logo_url;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-8">
          {logoSrc ? (
            <img src={logoSrc} alt={branding.site_name} className="h-12 w-12 rounded-xl object-contain" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Wifi className="h-7 w-7 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{branding.site_name}</h1>
            <p className="text-sm text-muted-foreground">{t.portal.customerPortal}</p>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t.portal.customerLogin}</CardTitle>
            <CardDescription>{t.portal.loginSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pppoe-username">{t.portal.pppoeUsername}</Label>
                <Input id="pppoe-username" placeholder={t.portal.pppoeUsernamePlaceholder} value={pppoeUsername} onChange={(e) => setPppoeUsername(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pppoe-password">{t.portal.pppoePassword}</Label>
                <Input id="pppoe-password" type="password" placeholder="••••••••" value={pppoePassword} onChange={(e) => setPppoePassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t.portal.signIn}
              </Button>
            </form>
          </CardContent>
        </Card>

        {branding.support_email || branding.support_phone ? (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>{t.portal.needHelp}</p>
            {branding.support_email && <p>{branding.support_email}</p>}
            {branding.support_phone && <p>{branding.support_phone}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
