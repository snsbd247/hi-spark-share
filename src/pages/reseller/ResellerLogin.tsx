import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, LogIn, Wifi, Eye, EyeOff, User, Lock } from "lucide-react";
import { toast } from "sonner";

export default function ResellerLogin() {
  const navigate = useNavigate();
  const { signIn } = useResellerAuth();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    try {
      await signIn(userId, password);
      toast.success("Login successful!");
      navigate("/reseller/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
            <Wifi className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Reseller Portal</CardTitle>
          <CardDescription>Sign in with your User ID and password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label>User ID</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter your User ID"
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <Link to="/admin/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Admin Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
