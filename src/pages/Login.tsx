import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wifi, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Step 1: Verify username + bcrypt password via edge function
      const { data: loginData, error: loginError } = await supabase.functions.invoke("admin-login", {
        body: { username, password },
      });

      if (loginError) throw new Error(loginError.message || "Login failed");
      if (loginData?.error) throw new Error(loginData.error);

      // Step 2: Sign in with Supabase Auth using the resolved email
      await signIn(loginData.email, password);

      navigate("/");
      toast.success("Welcome back!");
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
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Wifi className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Smart ISP</h1>
            <p className="text-sm text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Admin Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the admin panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
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
            <div className="mt-4 text-center space-y-2">
              <a href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors block">
                ← Customer Login
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
