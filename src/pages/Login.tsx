import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wifi, Loader2, Eye, EyeOff, Lock, User } from "lucide-react";
import api from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Login() {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { branding } = useTenantBranding();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(username, password);
      navigate("/");
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = branding.login_logo_url || branding.logo_url;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary-foreground rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary-foreground rounded-full translate-x-1/4 translate-y-1/4" />
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-primary-foreground rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-primary-foreground">
          {logoSrc ? (
            <img src={logoSrc} alt={branding.site_name} className="h-20 w-20 rounded-2xl object-contain mb-6 shadow-lg ring-2 ring-primary-foreground/20" />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center mb-6 shadow-lg ring-2 ring-primary-foreground/20">
              <Wifi className="h-10 w-10" />
            </div>
          )}
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">{branding.site_name}</h1>
          <p className="text-lg font-medium opacity-80 mb-8">Internet Service Management</p>
          <div className="space-y-4 max-w-sm text-center">
            <div className="flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm rounded-xl px-5 py-3">
              <div className="h-2 w-2 rounded-full bg-success shrink-0" />
              <span className="text-sm opacity-90">Real-time network monitoring & control</span>
            </div>
            <div className="flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm rounded-xl px-5 py-3">
              <div className="h-2 w-2 rounded-full bg-success shrink-0" />
              <span className="text-sm opacity-90">Automated billing & payment processing</span>
            </div>
            <div className="flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm rounded-xl px-5 py-3">
              <div className="h-2 w-2 rounded-full bg-success shrink-0" />
              <span className="text-sm opacity-90">Customer & subscription management</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            {logoSrc ? (
              <img src={logoSrc} alt={branding.site_name} className="h-12 w-12 rounded-xl object-contain" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <Wifi className="h-7 w-7 text-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{branding.site_name}</h1>
              <p className="text-xs text-muted-foreground">{t.sidebar.adminPanel}</p>
            </div>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">{t.auth.loginTitle}</h2>
            <p className="text-muted-foreground mt-1">{t.auth.loginSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">{t.auth.username}</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">{t.auth.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10 pr-10 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.auth.signIn}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <a href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Customer Portal Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}