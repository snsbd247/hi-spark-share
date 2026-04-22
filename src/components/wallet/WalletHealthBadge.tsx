import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, AlertTriangle, Loader2, Activity, RefreshCcw, Database, Calculator, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface CheckRow {
  ok: boolean;
  label: string;
  error?: string;
  accounts?: Record<string, { name: string; present: boolean }>;
  gateways?: Record<string, { configured: boolean; enabled: boolean }>;
}

const SUBSYSTEM_META: Record<string, { icon: React.ComponentType<{ className?: string }>; title: string }> = {
  database: { icon: Database, title: "Database" },
  schema: { icon: Database, title: "Wallet schema" },
  accounting: { icon: Calculator, title: "Accounting service" },
  gateways: { icon: CreditCard, title: "Payment gateways" },
};

export function WalletHealthBadge() {
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<{
    ok: boolean;
    checked_at: string;
    checks: Record<string, CheckRow>;
  }>({
    queryKey: ["wallet-health"],
    queryFn: async () => (await api.get("/wallet/health")).data,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const ok = !!data?.ok;
  const checks = data?.checks ?? {};
  const lastChecked = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="text-xs">
            {isLoading ? "Checking…" : ok ? "Wallet OK" : "Wallet issues"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Wallet health
          </h4>
          <Button
            size="sm"
            variant="ghost"
            disabled={isFetching}
            onClick={() => refetch()}
            className="gap-1 h-7"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="text-xs">Retry</span>
          </Button>
        </div>

        <div className="space-y-2">
          {Object.entries(checks).map(([key, c]) => {
            const meta = SUBSYSTEM_META[key] || { icon: Activity, title: key };
            const Icon = meta.icon;
            return (
              <div
                key={key}
                className={`rounded-md border p-2.5 ${
                  c.ok ? "border-border bg-muted/30" : "border-destructive/40 bg-destructive/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`h-4 w-4 mt-0.5 ${c.ok ? "text-primary" : "text-destructive"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium capitalize">{meta.title}</span>
                      <Badge variant={c.ok ? "default" : "destructive"} className="text-[10px] h-5">
                        {c.ok ? "OK" : "FAIL"}
                      </Badge>
                    </div>
                    <div className={`text-xs mt-0.5 ${c.ok ? "text-muted-foreground" : "text-destructive"}`}>
                      {c.label}
                    </div>
                    {c.accounts && (
                      <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
                        {Object.entries(c.accounts).map(([code, a]) => (
                          <div key={code} className="flex items-center gap-1">
                            <span className={a.present ? "text-primary" : "text-destructive"}>
                              {a.present ? "✓" : "✗"}
                            </span>
                            <span className="font-mono">{code}</span>
                            <span>— {a.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {c.gateways && (
                      <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
                        {Object.entries(c.gateways).map(([g, s]) => (
                          <div key={g} className="flex items-center gap-1 capitalize">
                            <span className={s.enabled ? "text-primary" : s.configured ? "text-amber-500" : "text-destructive"}>
                              {s.enabled ? "✓" : s.configured ? "•" : "✗"}
                            </span>
                            <span>{g}</span>
                            <span className="text-muted-foreground/70">
                              {s.enabled ? "(enabled)" : s.configured ? "(configured, off)" : "(not configured)"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {c.error && (
                      <div className="text-[11px] text-destructive mt-1 font-mono break-all">{c.error}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {lastChecked && (
          <p className="text-[11px] text-muted-foreground mt-3 flex items-center justify-between">
            <span>Last checked: {formatDistanceToNow(lastChecked, { addSuffix: true })}</span>
            <span className="font-mono">{lastChecked.toLocaleTimeString()}</span>
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
