import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function SuperAdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect
  if (user) {
    // Check if super admin and redirect
    supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) navigate("/super-admin", { replace: true });
      });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Step 1: Verify credentials via edge function
      const { data: loginData, error: loginError } = await supabase.functions.invoke("admin-login", {
        body: { username, password },
      });

      if (loginError) throw new Error(loginError.message || "Login failed");
      if (loginData?.error) throw new Error(loginData.error);

      // Step 2: Sign in with Supabase Auth
      await signIn(loginData.email, password);

      // Step 3: Verify this user is a platform admin or super_admin role
      const userId = loginData.user_id;

      const { data: platformAdmin } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!platformAdmin) {
        // Fallback: check user_roles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "super_admin");

        if (!roles?.length) {
          await supabase.auth.signOut();
          throw new Error("You do not have Super Admin access");
        }
      }

      navigate("/super-admin", { replace: true });
      toast.success("Welcome, Super Admin!");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
            <Shield className="h-7 w-7 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
            <p className="text-sm text-muted-foreground">Platform Control Panel</p>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Super Admin Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the platform control panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="superadmin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>
            </form>
            <div className="mt-4 text-center">
              <a href="/admin/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                ← Tenant Admin Login
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
