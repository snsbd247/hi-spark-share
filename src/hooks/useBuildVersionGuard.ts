import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { checkBuildVersion, purgeWalletCache, BUILD_VERSION } from "@/lib/buildVersion";

/**
 * Mounts on wallet/settlement admin pages. If the build version changed since
 * the last visit, purge cached query data so the page never reads stale shapes.
 *
 * Reload is skipped — query cache invalidation is enough because the JS chunk
 * is already the new one (this hook only runs from the new chunk).
 */
export function useBuildVersionGuard() {
  const qc = useQueryClient();
  useEffect(() => {
    if (checkBuildVersion()) {
      purgeWalletCache();
      qc.removeQueries({ predicate: (q) => /wallet|settlement|coa-account/i.test(JSON.stringify(q.queryKey)) });
      // eslint-disable-next-line no-console
      console.info("[buildVersion] cache purged for new build", BUILD_VERSION);
    }
  }, [qc]);
}
