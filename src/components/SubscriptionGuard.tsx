import { ReactNode, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/supabase/client";
import { IS_LOVABLE } from "@/lib/environment";
import api from "@/lib/api";
import { ShieldAlert, Phone, RefreshCw, LogOut } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { sessionStore } from "@/lib/sessionStore";

interface SubscriptionStatus {
  hasSubscription: boolean;
  isExpired: boolean;
  loading: boolean;
}

function useSubscriptionStatus(): SubscriptionStatus & { recheck: () => void } {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({ hasSubscription: true, isExpired: false, loading: true });
  const [recheckKey, setRecheckKey] = useState(0);

  const recheck = useCallback(() => setRecheckKey((k) => k + 1), []);

  useEffect(() => {
    if (!user?.tenant_id) {
      setStatus({ hasSubscription: true, isExpired: false, loading: false });
      return;
    }

    const check = async () => {
      setStatus((s) => ({ ...s, loading: true }));
      try {
        if (IS_LOVABLE) {
          const now = new Date().toISOString().slice(0, 10);
          const { data: activeSub } = await db
            .from("subscriptions")
            .select("id,end_date,status")
            .eq("tenant_id", user.tenant_id)
            .eq("status", "active")
            .gte("end_date", now)
            .maybeSingle();

          if (activeSub) {
            setStatus({ hasSubscription: true, isExpired: false, loading: false });
            return;
          }

          const { data: expiredSub } = await db
            .from("subscriptions")
            .select("id,end_date,status")
            .eq("tenant_id", user.tenant_id)
            .order("end_date", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (expiredSub) {
            setStatus({ hasSubscription: true, isExpired: true, loading: false });
          } else {
            // Check tenant status directly
            const { data: tenant } = await (db.from as any)("tenants")
              .select("status, plan_expire_date")
              .eq("id", user.tenant_id)
              .single();

            if (tenant?.status === "active" && tenant?.plan_expire_date) {
              const expDate = new Date(tenant.plan_expire_date);
              if (expDate >= new Date()) {
                setStatus({ hasSubscription: true, isExpired: false, loading: false });
                return;
              }
            }
            setStatus({ hasSubscription: false, isExpired: false, loading: false });
          }
        } else {
          try {
            const { data } = await api.get("/admin/subscription-status");
            setStatus({
              hasSubscription: data?.has_subscription ?? true,
              isExpired: data?.is_expired ?? false,
              loading: false,
            });
          } catch {
            setStatus({ hasSubscription: true, isExpired: false, loading: false });
          }
        }
      } catch {
        setStatus({ hasSubscription: true, isExpired: false, loading: false });
      }
    };

    check();
  }, [user?.tenant_id, recheckKey]);

  return { ...status, recheck };
}

export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const { hasSubscription, isExpired, loading, recheck } = useSubscriptionStatus();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [checking, setChecking] = useState(false);

  if (!user?.tenant_id || loading) return <>{children}</>;

  const isBlocked = !hasSubscription || isExpired;
  if (!isBlocked) return <>{children}</>;

  const handleRefresh = async () => {
    setChecking(true);
    recheck();
    setTimeout(() => setChecking(false), 1500);
  };

  const handleBackToLogin = () => {
    sessionStore.removeItem("admin_user");
    sessionStore.removeItem("admin_token");
    window.location.href = "/admin/login";
  };

  const title = isExpired
    ? (t as any).subscriptionGuard?.expired || "Subscription Expired"
    : (t as any).subscriptionGuard?.noSubscription || "No Active Subscription";

  const message = isExpired
    ? (t as any).subscriptionGuard?.expiredMessage || "আপনার প্যাকেজ Subscription এর মেয়াদ শেষ, দয়া করে এডমিন এর সাথে যোগাযোগ করুন।"
    : (t as any).subscriptionGuard?.noSubscriptionMessage || "আপনার কোন প্যাকেজ Subscription করা নাই, দয়া করে এডমিন এর সাথে যোগাযোগ করুন।";

  const refreshText = (t as any).subscriptionGuard?.refresh || "Refresh";
  const backText = (t as any).subscriptionGuard?.backToLogin || "Back to Login";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-base text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold text-foreground">মোবাইলঃ ০১৩১৫৫৫৬৬৩৩</span>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={handleRefresh} disabled={checking} className="w-full" size="lg">
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {refreshText}
          </Button>
          <Button onClick={handleBackToLogin} variant="outline" className="w-full" size="lg">
            <LogOut className="h-4 w-4 mr-2" />
            {backText}
          </Button>
        </div>
      </div>
    </div>
  );
}
