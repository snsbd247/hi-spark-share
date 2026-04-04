import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  const { branding } = useBranding();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(username, password);
      navigate("/dashboard");
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = branding.login_logo_url || branding.logo_url;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] animate-fade-in">
        <Card className="shadow-lg border-border/50">
          <CardContent className="p-8">
            {/* Logo & Title */}
            <div className="flex flex-col items-center gap-3 mb-8">
              {logoSrc ? (
                <img src={logoSrc} alt={branding.site_name} className="h-14 w-14 rounded-xl object-contain" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center">
                  <Wifi className="h-8 w-8 text-primary-foreground" />
                </div>
              )}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">{branding.site_name}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t.auth.loginSubtitle}</p>
              </div>
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

            <div className="mt-6 pt-5 border-t border-border space-y-2 text-center">
              <a href="/reseller/login" className="block text-sm text-primary hover:text-primary/80 font-medium transition-colors">
                Reseller Login →
              </a>
              <a href="/login" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                ← Customer Portal Login
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
