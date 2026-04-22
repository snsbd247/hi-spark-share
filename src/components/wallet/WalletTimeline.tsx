import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowDownRight, ArrowUpRight, RefreshCcw, X, Filter } from "lucide-react";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { nsQueryKey } from "@/lib/buildVersion";

interface Txn {
  id: string;
  customer_id: string;
  customer?: { name?: string; phone?: string; customer_id?: string };
  type: "credit" | "debit";
  amount: string | number;
  source: string;
  gateway?: string | null;
  reference_id?: string | null;
  reference_type?: string | null;
  description?: string;
  balance_after: string | number;
  created_at: string;
}

export function WalletTimeline({
  customerId,
  compact = false,
}: {
  customerId?: string;
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("");
  const [refId, setRefId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: nsQueryKey("wallet-timeline", customerId, type, from, to),
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "100" });
      if (customerId) params.set("customer_id", customerId);
      if (type) params.set("type", type);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return (await api.get(`/wallet/history?${params}`)).data;
    },
    refetchInterval: 15000,
  });

  const txns: Txn[] = useMemo(() => {
    return (data?.data || []).filter((t: Txn) => {
      if (refId && !(t.reference_id || "").toLowerCase().includes(refId.toLowerCase())) {
        return false;
      }
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        t.description?.toLowerCase().includes(s) ||
        t.reference_id?.toLowerCase().includes(s) ||
        t.customer?.name?.toLowerCase().includes(s) ||
        t.customer?.phone?.includes(s) ||
        t.customer?.customer_id?.toLowerCase().includes(s)
      );
    });
  }, [data, search, refId]);

  const activeFilterCount = [type, refId, from, to].filter(Boolean).length;

  const clearFilters = () => {
    setType("");
    setRefId("");
    setFrom("");
    setTo("");
    setSearch("");
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Audit Timeline</CardTitle>
          <div className="flex gap-2 items-center">
            <Input
              placeholder={customerId ? "Search description / ref…" : "Search ref / customer…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56"
            />
            <Button
              variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="gap-1"
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">{activeFilterCount}</Badge>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end p-3 rounded-md bg-muted/40 border">
            <div>
              <Label className="text-xs">Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">All</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Reference ID</Label>
              <Input
                value={refId}
                onChange={(e) => setRefId(e.target.value)}
                placeholder="trx-..."
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <div className={compact ? "max-h-[480px] overflow-y-auto" : ""}>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading timeline…</div>
          ) : txns.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transactions {activeFilterCount || search ? "match the filters" : "yet"}
            </div>
          ) : (
            <ol className="relative border-l border-border ml-6 my-4">
              {txns.map((t) => {
                const isCredit = t.type === "credit";
                return (
                  <li key={t.id} className="mb-4 ml-6">
                    <span
                      className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${
                        isCredit ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {isCredit ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold ${isCredit ? "text-primary" : "text-destructive"}`}>
                        {isCredit ? "+" : "-"}৳{Number(t.amount).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="capitalize text-xs">
                        {t.source}
                        {t.gateway ? ` · ${t.gateway}` : ""}
                      </Badge>
                      {!customerId && t.customer?.name && (
                        <span className="text-xs text-muted-foreground">
                          → {t.customer.name} ({t.customer.phone || t.customer.customer_id})
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {format(new Date(t.created_at), "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      {t.reference_id && (
                        <span>
                          Ref: <span className="font-mono">{t.reference_id}</span>
                          {t.reference_type ? ` (${t.reference_type})` : ""}
                        </span>
                      )}
                      <span>
                        Balance after: <span className="font-medium">৳{Number(t.balance_after).toLocaleString()}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
