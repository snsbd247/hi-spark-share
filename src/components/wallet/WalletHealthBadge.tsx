import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, AlertTriangle, Loader2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CheckRow {
  ok: boolean;
  label: string;
  error?: string;
  accounts?: Record<string, { name: string; present: boolean }>;
  gateways?: Record<string, { configured: boolean; enabled: boolean }>;
}

export function WalletHealthBadge() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
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
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Wallet health
          </h4>
          <Button
            size="sm"
            variant="ghost"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? "…" : "Recheck"}
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          {Object.entries(checks).map(([key, c]) => (
            <div key={key} className="flex items-start gap-2">
              <Badge
                variant={c.ok ? "default" : "destructive"}
                className="mt-0.5 capitalize"
              >
                {key}
              </Badge>
              <div className="flex-1">
                <div className={c.ok ? "" : "text-destructive"}>{c.label}</div>
                {c.accounts && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {Object.entries(c.accounts).map(([code, a]) => (
                      <div key={code}>
                        {a.present ? "✓" : "✗"} {code} — {a.name}
                      </div>
                    ))}
                  </div>
                )}
                {c.gateways && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {Object.entries(c.gateways).map(([g, s]) => (
                      <div key={g}>
                        {s.enabled ? "✓" : s.configured ? "•" : "✗"} {g}
                      </div>
                    ))}
                  </div>
                )}
                {c.error && (
                  <div className="text-xs text-destructive mt-1">{c.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        {data?.checked_at && (
          <p className="text-xs text-muted-foreground mt-3">
            Checked: {new Date(data.checked_at).toLocaleTimeString()}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
