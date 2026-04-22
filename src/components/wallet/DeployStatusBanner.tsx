import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { BUILD_VERSION, WALLET_SCHEMA_REV, CACHE_NAMESPACE } from "@/lib/buildVersion";
import { Rocket, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

const RELEASE_TAG = "v1.17.2";

/**
 * Compact post-deploy status banner shown above WalletManagement.
 * Surfaces:
 *   - migration/seeder release tag (v1.17.2)
 *   - frontend build + schema revision
 *   - last wallet-health check timestamp (re-uses /wallet/health)
 *   - quick OK/FAIL pulse from the same endpoint
 *
 * Read-only — no business logic, no integration calls.
 */
export function DeployStatusBanner() {
  const { data, dataUpdatedAt, isLoading } = useQuery<{
    ok: boolean;
    checked_at: string;
  }>({
    queryKey: ["wallet-health", "banner"],
    queryFn: async () => (await api.get("/wallet/health")).data,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const ok = !!data?.ok;
  const lastChecked = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div
      className={`rounded-lg border p-3 flex flex-wrap items-center gap-3 text-sm ${
        ok
          ? "border-primary/30 bg-primary/5"
          : "border-destructive/30 bg-destructive/5"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-primary" />
        <span className="font-semibold">Wallet release</span>
        <Badge variant="default" className="font-mono">{RELEASE_TAG}</Badge>
      </div>

      <span className="text-muted-foreground hidden md:inline">·</span>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Build</span>
        <code className="font-mono px-1.5 py-0.5 rounded bg-muted">{BUILD_VERSION}</code>
        <span>· Schema</span>
        <code className="font-mono px-1.5 py-0.5 rounded bg-muted">{WALLET_SCHEMA_REV}</code>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          {isLoading ? (
            <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
          ) : ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={ok ? "text-foreground" : "text-destructive"}>
            {isLoading ? "Checking…" : ok ? "All subsystems healthy" : "Subsystem issues — check health badge"}
          </span>
        </div>

        {lastChecked && (
          <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
            {formatDistanceToNow(lastChecked, { addSuffix: true })}
          </span>
        )}

        <span
          className="text-[10px] text-muted-foreground/70 font-mono hidden lg:inline"
          title="React Query cache namespace"
        >
          ns:{CACHE_NAMESPACE}
        </span>
      </div>
    </div>
  );
}
