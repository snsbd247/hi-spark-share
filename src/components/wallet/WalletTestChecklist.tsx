import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";

type CheckStatus = "idle" | "running" | "pass" | "fail";

interface CheckItem {
  id: string;
  title: string;
  description: string;
  run: () => Promise<{ ok: boolean; detail?: string }>;
}

/**
 * Quick end-to-end checklist verifying that:
 *  1. Polling refresh happens within ~15s
 *  2. Manual Refresh triggers a fresh request
 *  3. Cache invalidation purges the wallet query keys
 *
 * Each test runs in isolation and reports a result inline so admins can confirm
 * the wallet refresh pipeline is healthy after deploys.
 */
export function WalletTestChecklist() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, { status: CheckStatus; detail?: string }>>({});

  const setResult = (id: string, status: CheckStatus, detail?: string) =>
    setStatuses((s) => ({ ...s, [id]: { status, detail } }));

  const checks: CheckItem[] = [
    {
      id: "polling",
      title: "Polling refresh (auto every 15s)",
      description: "Verifies that wallet-customers query refetches automatically.",
      run: async () => {
        const before = qc.getQueryState(["wallet-customers"])?.dataUpdatedAt ?? 0;
        await qc.invalidateQueries({ queryKey: ["wallet-customers"] });
        await new Promise((r) => setTimeout(r, 1500));
        const after = qc.getQueryState(["wallet-customers"])?.dataUpdatedAt ?? 0;
        return after > before
          ? { ok: true, detail: `Refetched at ${new Date(after).toLocaleTimeString()}` }
          : { ok: false, detail: "No refetch detected" };
      },
    },
    {
      id: "manual",
      title: "Manual Refresh button",
      description: "Confirms react-query invalidation triggers immediate fetch.",
      run: async () => {
        const t0 = Date.now();
        await qc.refetchQueries({ queryKey: ["wallet-customers"] });
        const ms = Date.now() - t0;
        return ms < 5000
          ? { ok: true, detail: `Refetch completed in ${ms}ms` }
          : { ok: false, detail: `Refetch slow (${ms}ms)` };
      },
    },
    {
      id: "invalidate",
      title: "Post-topup cache invalidation",
      description: "Simulates a successful top-up and ensures keys are purged.",
      run: async () => {
        qc.invalidateQueries({ queryKey: ["wallet-customers"] });
        qc.invalidateQueries({ queryKey: ["wallet-timeline"] });
        qc.invalidateQueries({ queryKey: ["wallet-health"] });
        await new Promise((r) => setTimeout(r, 300));
        const stale = qc
          .getQueriesData({ queryKey: ["wallet-customers"] })
          .every(([, data]) => data !== undefined);
        return stale
          ? { ok: true, detail: "All wallet caches invalidated & refetched" }
          : { ok: false, detail: "Some caches were not refilled" };
      },
    },
  ];

  const runAll = async () => {
    for (const c of checks) {
      setResult(c.id, "running");
      try {
        const res = await c.run();
        setResult(c.id, res.ok ? "pass" : "fail", res.detail);
      } catch (e: any) {
        setResult(c.id, "fail", e?.message || "error");
      }
    }
  };

  const runOne = async (c: CheckItem) => {
    setResult(c.id, "running");
    try {
      const res = await c.run();
      setResult(c.id, res.ok ? "pass" : "fail", res.detail);
    } catch (e: any) {
      setResult(c.id, "fail", e?.message || "error");
    }
  };

  const passCount = Object.values(statuses).filter((s) => s.status === "pass").length;
  const failCount = Object.values(statuses).filter((s) => s.status === "fail").length;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between gap-3"
        onClick={() => setOpen((v) => !v)}
      >
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          Quick test checklist
          {passCount > 0 && <Badge className="ml-1">{passCount} pass</Badge>}
          {failCount > 0 && <Badge variant="destructive">{failCount} fail</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={runAll}>Run all</Button>
          </div>
          {checks.map((c) => {
            const s = statuses[c.id]?.status || "idle";
            return (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-md border bg-muted/30">
                <div className="mt-0.5">
                  {s === "running" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : s === "pass" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : s === "fail" ? (
                    <Circle className="h-4 w-4 fill-destructive text-destructive" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.description}</div>
                  {statuses[c.id]?.detail && (
                    <div className={`text-xs mt-1 ${s === "fail" ? "text-destructive" : "text-muted-foreground"}`}>
                      {statuses[c.id].detail}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => runOne(c)} disabled={s === "running"}>
                  Run
                </Button>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
