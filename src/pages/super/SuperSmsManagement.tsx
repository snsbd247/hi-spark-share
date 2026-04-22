import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  Loader2, Save, Settings, Plus, MessageSquare, ArrowUpCircle, ArrowDownCircle,
  Wifi, WifiOff, AlertTriangle, TrendingUp, Activity, Zap, RefreshCw, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

const LOW_BALANCE_THRESHOLD = 100;

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 220 70% 50%))",
  "hsl(var(--chart-3, 280 65% 60%))",
  "hsl(var(--chart-4, 340 75% 55%))",
  "hsl(var(--chart-5, 30 80% 55%))",
  "hsl(160 60% 45%)",
  "hsl(200 70% 50%)",
  "hsl(45 90% 50%)",
];

const chartConfig = {
  sent: { label: "Sent", color: "hsl(142 76% 36%)" },
  failed: { label: "Failed", color: "hsl(0 84% 60%)" },
  total: { label: "Total SMS", color: "hsl(var(--primary))" },
  balance: { label: "Balance", color: "hsl(var(--primary))" },
  revenue: { label: "Revenue", color: "hsl(142 76% 36%)" },
  cost: { label: "Cost", color: "hsl(0 84% 60%)" },
  profit: { label: "Profit", color: "hsl(var(--primary))" },
};

export default function SuperSmsManagement() {
  const { t } = useLanguage();
  const sa = t.superAdmin;
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeDesc, setRechargeDesc] = useState("");
  const [smsRateInput, setSmsRateInput] = useState("");
  const [selectedTenantTx, setSelectedTenantTx] = useState<string | null>(null);
  const [historyTenant, setHistoryTenant] = useState<string>("all");
  const [historyStatus, setHistoryStatus] = useState<string>("all");
  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPerPage, setHistoryPerPage] = useState<number>(50);
  const [historyExporting, setHistoryExporting] = useState<boolean>(false);
  const [detailLog, setDetailLog] = useState<any | null>(null);

  // ── Global SMS Settings ─────────────────────
  const { data: smsSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["super-sms-settings"],
    queryFn: async () => {
      const { IS_LOVABLE } = await import("@/lib/environment");
      if (!IS_LOVABLE) {
        const { default: api } = await import("@/lib/api");
        const { data } = await api.get("/super-admin/sms-settings");
        return data;
      }
      const { data } = await db.from("sms_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  if (smsSettings && !form) {
    setForm({ ...smsSettings });
  }

  // ── Live API Balance & Sent Stats ────────────────────────
  const { data: liveBalance, isLoading: balanceLoading, error: balanceError, refetch: refetchBalance } = useQuery({
    queryKey: ["super-live-sms-balance"],
    queryFn: async () => {
      // On VPS super admin, call the dedicated super admin endpoint
      const { IS_LOVABLE } = await import("@/lib/environment");
      if (!IS_LOVABLE) {
        const { default: api } = await import("@/lib/api");
        const { data } = await api.get("/super-admin/sms-balance");
        if (data?.error) throw new Error(data.error);
        return data;
      }
      const { data, error } = await db.functions.invoke("sms-balance");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const apiBalance = useMemo(() => {
    if (!liveBalance) return null;
    const balArr = liveBalance.balance || liveBalance;
    // GreenWeb returns [{action:"balance", response:"154.66"}, {action:"expiry", response:"..."}, ...]
    if (Array.isArray(balArr) && balArr.length > 0) {
      const findAction = (name: string) => balArr.find((b: any) => b.action === name)?.response;
      const balVal = findAction("balance");
      if (balVal !== undefined) {
        return {
          balance: balVal,
          expire_date: findAction("expiry") ?? null,
          rate: findAction("rate") ?? null,
        };
      }
      // Fallback: old format
      const item = balArr[0];
      return {
        balance: item.balance ?? item.remaining ?? item.credit ?? null,
        expire_date: item.expire_date ?? item.expiry ?? item.expire ?? null,
        rate: item.rate ?? item.sms_rate ?? null,
      };
    }
    if (typeof balArr === 'object' && balArr !== null) {
      return {
        balance: balArr.balance ?? balArr.remaining ?? balArr.credit ?? balArr.response ?? null,
        expire_date: balArr.expire_date ?? balArr.expiry ?? balArr.expire ?? null,
        rate: balArr.rate ?? balArr.sms_rate ?? null,
      };
    }
    return null;
  }, [liveBalance]);

  const apiTotalSent = liveBalance?.total_sent ?? null;

  // ── SMS Wallets (all tenants) ───────────────
  const { data: wallets = [], isLoading: walletsLoading } = useQuery({
    queryKey: ["super-sms-wallets"],
    queryFn: async () => {
      const { data: tenants } = await db.from("tenants").select("id, name, subdomain, status").order("name");
      const { data: walletData } = await db.from("sms_wallets").select("*");
      const walletMap: Record<string, any> = {};
      (walletData || []).forEach((w: any) => { walletMap[w.tenant_id] = w; });
      return (tenants || []).map((t: any) => ({
        tenant_id: t.id,
        tenant_name: t.name,
        subdomain: t.subdomain,
        status: t.status,
        balance: walletMap[t.id]?.balance || 0,
        sms_rate: walletMap[t.id]?.sms_rate ?? 0.50,
        wallet_id: walletMap[t.id]?.id || null,
      }));
    },
  });

  // ── SMS Logs for Analytics (with profit data) ──────────────────
  const { data: smsLogs = [] } = useQuery({
    queryKey: ["super-sms-logs-analytics"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data } = await db
        .from("sms_logs")
        .select("id, created_at, status, sms_type, tenant_id, sms_count, cost, admin_cost, profit")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // ── Daily Usage Chart Data ──────────────────
  const dailyUsage = useMemo(() => {
    const map: Record<string, { date: string; sent: number; failed: number; revenue: number; cost: number; profit: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      map[d] = { date: d, sent: 0, failed: 0, revenue: 0, cost: 0, profit: 0 };
    }
    smsLogs.forEach((log: any) => {
      const d = format(new Date(log.created_at), "yyyy-MM-dd");
      if (map[d]) {
        map[d].revenue += Number(log.cost || 0);
        map[d].cost += Number(log.admin_cost || 0);
        map[d].profit += Number(log.profit || 0);
        if (log.status === "sent") map[d].sent += (log.sms_count || 1);
        else map[d].failed += (log.sms_count || 1);
      }
    });
    return Object.values(map);
  }, [smsLogs]);

  // ── Per-Tenant Consumption + Profit ──────────────────
  const tenantConsumption = useMemo(() => {
    const map: Record<string, { tenant_id: string; total: number; revenue: number; admin_cost: number; profit: number }> = {};
    smsLogs.forEach((log: any) => {
      const tid = log.tenant_id || "unknown";
      if (!map[tid]) map[tid] = { tenant_id: tid, total: 0, revenue: 0, admin_cost: 0, profit: 0 };
      map[tid].total += (log.sms_count || 1);
      map[tid].revenue += Number(log.cost || 0);
      map[tid].admin_cost += Number(log.admin_cost || 0);
      map[tid].profit += Number(log.profit || 0);
    });
    const result = Object.values(map).sort((a, b) => b.total - a.total);
    return result.map((item) => {
      const w = wallets.find((w: any) => w.tenant_id === item.tenant_id);
      return { ...item, tenant_name: w?.tenant_name || "Unknown" };
    });
  }, [smsLogs, wallets]);

  // ── SMS Type Breakdown ──────────────────────
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    smsLogs.forEach((log: any) => {
      const type = log.sms_type || "other";
      map[type] = (map[type] || 0) + (log.sms_count || 1);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [smsLogs]);

  // ── Low Balance Tenants ─────────────────────
  const lowBalanceTenants = useMemo(() => {
    return wallets.filter((w: any) => w.balance < LOW_BALANCE_THRESHOLD && w.status === "active");
  }, [wallets]);

  // ── SMS Transactions ────────────────────────
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["super-sms-transactions", selectedTenantTx],
    queryFn: async () => {
      let query = db.from("sms_transactions").select("*").order("created_at", { ascending: false }).limit(100);
      if (selectedTenantTx) query = query.eq("tenant_id", selectedTenantTx);
      const { data } = await query;
      return data || [];
    },
  });

  // ── Full SMS History (Super Admin) — paginated ─────────
  const { data: historyPageData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["super-sms-history", historyTenant, historyStatus, historySearch, historyPage, historyPerPage],
    queryFn: async () => {
      const { IS_LOVABLE } = await import("@/lib/environment");
      if (!IS_LOVABLE) {
        const { default: api } = await import("@/lib/api");
        const params: any = { page: historyPage, per_page: historyPerPage };
        if (historyTenant !== "all") params.tenant_id = historyTenant;
        if (historyStatus !== "all") params.status = historyStatus;
        if (historySearch) params.search = historySearch;
        const { data } = await api.get("/super-admin/sms-logs", { params });
        return {
          rows: data?.data ?? [],
          total: data?.total ?? 0,
          last_page: data?.last_page ?? 1,
        };
      }
      const from = (historyPage - 1) * historyPerPage;
      const to = from + historyPerPage - 1;
      let q = db.from("sms_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
      if (historyTenant !== "all") q = q.eq("tenant_id", historyTenant);
      if (historyStatus !== "all") q = q.eq("status", historyStatus);
      if (historySearch) q = q.or(`phone.ilike.%${historySearch}%,message.ilike.%${historySearch}%`);
      const { data, count } = await q;
      const total = count ?? 0;
      return { rows: data || [], total, last_page: Math.max(1, Math.ceil(total / historyPerPage)) };
    },
  });
  const smsHistory: any[] = historyPageData?.rows ?? [];
  const historyTotal: number = historyPageData?.total ?? 0;
  const historyLastPage: number = historyPageData?.last_page ?? 1;

  const tenantNameFor = (tenantId: string | null | undefined): string => {
    if (!tenantId) return "—";
    return wallets.find((w: any) => w.tenant_id === tenantId)?.tenant_name ?? tenantId.substring(0, 8);
  };

  const handleHistoryExport = async () => {
    setHistoryExporting(true);
    try {
      const { IS_LOVABLE } = await import("@/lib/environment");
      const { rowsToCsv, downloadCsv } = await import("@/lib/csvExport");
      let allRows: any[] = [];

      if (!IS_LOVABLE) {
        const { default: api } = await import("@/lib/api");
        const MAX_PAGES = 10;
        const SIZE = 500;
        for (let p = 1; p <= MAX_PAGES; p++) {
          const params: any = { page: p, per_page: SIZE };
          if (historyTenant !== "all") params.tenant_id = historyTenant;
          if (historyStatus !== "all") params.status = historyStatus;
          if (historySearch) params.search = historySearch;
          const { data } = await api.get("/super-admin/sms-logs", { params });
          const chunk = data?.data ?? [];
          allRows = allRows.concat(chunk);
          if (chunk.length < SIZE) break;
        }
      } else {
        let q = db.from("sms_logs").select("*").order("created_at", { ascending: false }).limit(5000);
        if (historyTenant !== "all") q = q.eq("tenant_id", historyTenant);
        if (historyStatus !== "all") q = q.eq("status", historyStatus);
        if (historySearch) q = q.or(`phone.ilike.%${historySearch}%,message.ilike.%${historySearch}%`);
        const { data } = await q;
        allRows = data || [];
      }

      if (!allRows.length) {
        toast.info("No records to export");
        return;
      }

      const csv = rowsToCsv(allRows, [
        { header: "Time", value: (r: any) => r.created_at ? format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss") : "" },
        { header: "Tenant", value: (r: any) => tenantNameFor(r.tenant_id) },
        { header: "Tenant ID", value: (r: any) => r.tenant_id ?? "" },
        { header: "Phone", value: (r: any) => r.phone },
        { header: "Type", value: (r: any) => r.sms_type },
        { header: "Message", value: (r: any) => r.message },
        { header: "Status", value: (r: any) => r.status },
        { header: "Segments", value: (r: any) => r.sms_count ?? 1 },
        { header: "Cost", value: (r: any) => r.cost ?? "" },
        { header: "Admin Cost", value: (r: any) => r.admin_cost ?? "" },
        { header: "Profit", value: (r: any) => r.profit ?? "" },
        { header: "Response", value: (r: any) => r.response },
      ]);
      const stamp = format(new Date(), "yyyyMMdd-HHmm");
      downloadCsv(`super-sms-history-${stamp}.csv`, csv);
      toast.success(`Exported ${allRows.length} record(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setHistoryExporting(false);
    }
  };

  const totalBalance = wallets.reduce((sum: number, w: any) => sum + (w.balance || 0), 0);
  const totalSent = smsLogs.filter((l: any) => l.status === "sent").length;
  const totalFailed = smsLogs.filter((l: any) => l.status === "failed").length;
  const totalRevenue = smsLogs.reduce((sum: number, l: any) => sum + Number(l.cost || 0), 0);
  const totalAdminCost = smsLogs.reduce((sum: number, l: any) => sum + Number(l.admin_cost || 0), 0);
  const totalProfit = smsLogs.reduce((sum: number, l: any) => sum + Number(l.profit || 0), 0);

  // ── Handlers ────────────────────────────────
  const handleSaveSettings = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { IS_LOVABLE } = await import("@/lib/environment");
      if (!IS_LOVABLE) {
        // VPS: use dedicated super admin endpoint
        const { default: api } = await import("@/lib/api");
        const { data } = await api.put("/super-admin/sms-settings", {
          api_token: form.api_token,
          sender_id: form.sender_id,
          admin_cost_rate: form.admin_cost_rate,
          sms_on_bill_generate: form.sms_on_bill_generate,
          sms_on_payment: form.sms_on_payment,
          sms_on_registration: form.sms_on_registration,
          sms_on_suspension: form.sms_on_suspension,
          sms_on_new_customer_bill: form.sms_on_new_customer_bill,
          whatsapp_token: form.whatsapp_token,
          whatsapp_phone_id: form.whatsapp_phone_id,
          whatsapp_enabled: form.whatsapp_enabled,
        });
        if (data) setForm({ ...data });
      } else {
        if (smsSettings?.id) {
          const { error } = await db.from("sms_settings").update({
            api_token: form.api_token,
            sender_id: form.sender_id,
            admin_cost_rate: form.admin_cost_rate,
            sms_on_bill_generate: form.sms_on_bill_generate,
            sms_on_payment: form.sms_on_payment,
            sms_on_registration: form.sms_on_registration,
            sms_on_suspension: form.sms_on_suspension,
            sms_on_new_customer_bill: form.sms_on_new_customer_bill,
            whatsapp_token: form.whatsapp_token,
            whatsapp_phone_id: form.whatsapp_phone_id,
            whatsapp_enabled: form.whatsapp_enabled,
            updated_at: new Date().toISOString(),
          }).eq("id", smsSettings.id);
          if (error) throw error;
        } else {
          const { error } = await db.from("sms_settings").insert({
            api_token: form.api_token,
            sender_id: form.sender_id,
            admin_cost_rate: form.admin_cost_rate,
          });
          if (error) throw error;
        }
      }
      toast.success("Global SMS settings saved");
      qc.invalidateQueries({ queryKey: ["super-sms-settings"] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecharge = async () => {
    if (!selectedTenant || !rechargeAmount) return;
    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    const newRate = smsRateInput ? parseFloat(smsRateInput) : null;
    if (newRate !== null && (isNaN(newRate) || newRate <= 0)) { toast.error("Enter a valid SMS rate"); return; }
    try {
      const { data: existing } = await db.from("sms_wallets").select("id, balance").eq("tenant_id", selectedTenant.tenant_id).maybeSingle();
      let newBalance: number;
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (existing) {
        newBalance = parseFloat((existing.balance + amount).toFixed(2));
        updatePayload.balance = newBalance;
        if (newRate !== null) updatePayload.sms_rate = newRate;
        await db.from("sms_wallets").update(updatePayload).eq("id", existing.id);
      } else {
        newBalance = amount;
        const insertPayload: any = { tenant_id: selectedTenant.tenant_id, balance: amount };
        if (newRate !== null) insertPayload.sms_rate = newRate;
        await db.from("sms_wallets").insert(insertPayload);
      }
      await db.from("sms_transactions").insert({
        tenant_id: selectedTenant.tenant_id,
        amount,
        type: "credit",
        description: (rechargeDesc || "SMS Recharge by Super Admin") + (newRate !== null ? ` (Rate: ৳${newRate}/SMS)` : ""),
        admin_id: "super_admin",
        balance_after: newBalance,
      });
      toast.success(`Recharged ৳${amount} to ${selectedTenant.tenant_name}`);
      setRechargeOpen(false);
      setRechargeAmount("");
      setRechargeDesc("");
      setSmsRateInput("");
      setSelectedTenant(null);
      qc.invalidateQueries({ queryKey: ["super-sms-wallets"] });
      qc.invalidateQueries({ queryKey: ["super-sms-transactions"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{sa.smsManagement}</h1>
        <p className="text-muted-foreground">Global SMS gateway, analytics, profit tracking & tenant balance management</p>
      </div>

      {/* ── Stats Row ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Live API Balance */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" /> {sa.liveApiBalance}
                </div>
                {!smsSettings?.api_token ? (
                  <div className="text-lg font-semibold text-muted-foreground">—</div>
                ) : balanceLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mt-1" />
                ) : balanceError ? (
                  <div className="text-sm text-destructive mt-1">{(balanceError as Error).message?.substring(0, 60) || "Failed"}</div>
                ) : apiBalance && apiBalance.balance != null ? (
                  <div className="text-2xl font-bold text-primary">{apiBalance.balance}</div>
                ) : (
                  <div className="text-lg font-semibold text-muted-foreground">N/A</div>
                )}
                {smsSettings?.api_token && apiBalance?.expire_date && (
                  <div className="text-xs text-muted-foreground mt-0.5">{sa.expiresLabel}: {apiBalance.expire_date}</div>
                )}
              </div>
              {smsSettings?.api_token && (
                <Button size="icon" variant="ghost" onClick={() => refetchBalance()} className="h-8 w-8">
                  <RefreshCw className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Tenant Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> {sa.tenantBalance}
            </div>
            <div className="text-2xl font-bold">৳{totalBalance.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{wallets.length} tenants</div>
          </CardContent>
        </Card>

        {/* Total Sent (GreenWeb API) */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> {sa.totalSentApi}
            </div>
            {!smsSettings?.api_token ? (
              <div className="text-lg font-semibold text-muted-foreground">—</div>
            ) : balanceLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mt-1" />
            ) : apiTotalSent !== null && apiTotalSent > 0 ? (
              <div className="text-2xl font-bold text-primary">{apiTotalSent.toLocaleString()}</div>
            ) : (
              <div className="text-2xl font-bold text-primary">{totalSent.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        {/* Total Profit */}
        <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" /> {sa.smsProfit30d}
            </div>
            <div className="text-2xl font-bold text-green-600">৳{totalProfit.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              Revenue: ৳{totalRevenue.toFixed(2)} | Cost: ৳{totalAdminCost.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        {/* Gateway Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> {sa.gatewayStatus}
            </div>
            <div className="mt-1">
              {smsSettings?.api_token ? (
                <Badge className="bg-green-600 text-white gap-1"><Wifi className="h-3 w-3" /> {t.common.active}</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> {sa.notConfiguredGateway}</Badge>
              )}
            </div>
            {smsSettings?.api_token && apiBalance?.rate ? (
              <div className="text-xs text-muted-foreground mt-1">API Rate: ৳{apiBalance.rate}/SMS</div>
            ) : !smsSettings?.api_token ? (
              <div className="text-xs text-muted-foreground mt-1">—</div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ── Low Balance Alert ──────────────────── */}
      {lowBalanceTenants.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-destructive">
                  ⚠️ Low SMS Balance — {lowBalanceTenants.length} tenant(s)
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lowBalanceTenants.map((t: any) => (
                    <Badge key={t.tenant_id} variant="outline" className="border-destructive/50 text-destructive gap-1">
                      {t.tenant_name}: ৳{Number(t.balance).toFixed(2)}
                      <Button size="sm" variant="ghost" className="h-5 px-1 ml-1 text-xs"
                        onClick={() => { setSelectedTenant(t); setRechargeOpen(true); }}>
                        Recharge
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabs ───────────────────────────────── */}
      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">{`📊 ${sa.analytics}`}</TabsTrigger>
          <TabsTrigger value="profit">{`💰 ${sa.profit}`}</TabsTrigger>
          <TabsTrigger value="wallets">{`🏦 ${sa.wallets}`}</TabsTrigger>
          <TabsTrigger value="history">{`📜 SMS History`}</TabsTrigger>
          <TabsTrigger value="settings">{`⚙️ ${sa.settings}`}</TabsTrigger>
        </TabsList>

        {/* ── Analytics Tab ────────────────────── */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{sa.smsUsage30d}</CardTitle>
              <CardDescription>Daily sent vs failed breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={dailyUsage} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "dd MMM")} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} labelFormatter={(d) => format(new Date(d), "dd MMM yyyy")} />
                  <Area type="monotone" dataKey="sent" stackId="1" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.3)" name="Sent" />
                  <Area type="monotone" dataKey="failed" stackId="1" stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60% / 0.3)" name="Failed" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{sa.tenantSmsConsumption}</CardTitle>
              </CardHeader>
              <CardContent>
                {tenantConsumption.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">{sa.noSmsData}</p>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={tenantConsumption.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="tenant_name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Total SMS" />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{sa.smsByType}</CardTitle>
              </CardHeader>
              <CardContent>
                {typeBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">{sa.noSmsData}</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ChartContainer config={chartConfig} className="h-[220px] w-[220px] shrink-0">
                      <PieChart>
                        <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                          {typeBreakdown.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                    <div className="space-y-1.5 text-sm">
                      {typeBreakdown.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground capitalize">{item.name.replace(/_/g, " ")}</span>
                          <span className="font-medium ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Profit Tab ───────────────────────── */}
        <TabsContent value="profit" className="space-y-4">
          {/* Daily Revenue vs Cost */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{sa.revenueCost30d}</CardTitle>
              <CardDescription>Daily tenant revenue charged vs admin SMS cost</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={dailyUsage} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "dd MMM")} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${v}`} />
                  <ChartTooltip content={<ChartTooltipContent />} labelFormatter={(d) => format(new Date(d), "dd MMM yyyy")} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.2)" name="Revenue (৳)" />
                  <Area type="monotone" dataKey="cost" stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60% / 0.2)" name="Cost (৳)" />
                  <Area type="monotone" dataKey="profit" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" name="Profit (৳)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Tenant-wise Profit Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{sa.tenantSmsProfit}</CardTitle>
              <CardDescription>Revenue charged to tenants vs your GreenWeb cost</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">{sa.smsSent}</TableHead>
                    <TableHead className="text-right">Revenue (৳)</TableHead>
                    <TableHead className="text-right">{sa.adminCost}</TableHead>
                    <TableHead className="text-right">Profit (৳)</TableHead>
                    <TableHead className="text-right">{sa.margin}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantConsumption.map((t) => {
                    const margin = t.revenue > 0 ? ((t.profit / t.revenue) * 100).toFixed(1) : "0.0";
                    return (
                      <TableRow key={t.tenant_id}>
                        <TableCell className="font-medium">{t.tenant_name}</TableCell>
                        <TableCell className="text-right">{t.total}</TableCell>
                        <TableCell className="text-right text-green-600">৳{t.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-destructive">৳{t.admin_cost.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">৳{t.profit.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(margin) > 30 ? "default" : "secondary"}>{margin}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {tenantConsumption.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{sa.noSmsDataProfit}</TableCell>
                    </TableRow>
                  )}
                  {tenantConsumption.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{tenantConsumption.reduce((s, t) => s + t.total, 0)}</TableCell>
                      <TableCell className="text-right text-green-600">৳{totalRevenue.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-destructive">৳{totalAdminCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-primary">৳{totalProfit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge>{totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0"}%</Badge>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Wallets Tab ──────────────────────── */}
        <TabsContent value="wallets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> {sa.tenantSmsBalances}
              </CardTitle>
              <CardDescription>Manage SMS credit for each tenant</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {walletsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Subdomain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">{sa.ratePerSms}</TableHead>
                      <TableHead className="text-right">{sa.balance}</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallets.map((w: any) => (
                      <TableRow key={w.tenant_id}>
                        <TableCell className="font-medium">{w.tenant_name}</TableCell>
                        <TableCell className="text-muted-foreground">{w.subdomain}</TableCell>
                        <TableCell>
                          <Badge variant={w.status === "active" ? "default" : "secondary"}>{w.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">৳{Number(w.sms_rate).toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${w.balance < LOW_BALANCE_THRESHOLD ? "text-destructive" : "text-green-600"}`}>
                            ৳{Number(w.balance).toFixed(2)}
                          </span>
                          {w.balance < LOW_BALANCE_THRESHOLD && w.status === "active" && (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive inline ml-1" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" onClick={() => { setSelectedTenant(w); setRechargeOpen(true); }}>
                              <Plus className="h-4 w-4 mr-1" /> Recharge
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={() => setSelectedTenantTx(selectedTenantTx === w.tenant_id ? null : w.tenant_id)}>
                              History
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {wallets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{sa.noTenantsFoundSms}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedTenantTx && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  SMS Transaction History
                  <Badge variant="outline" className="ml-2">
                    {wallets.find((w: any) => w.tenant_id === selectedTenantTx)?.tenant_name}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {txLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{sa.time}</TableHead>
                        <TableHead>{sa.type}</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>{sa.balanceAfter}</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx: any) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm">
                            {tx.created_at ? format(new Date(tx.created_at), "dd MMM yyyy HH:mm") : "—"}
                          </TableCell>
                          <TableCell>
                            {tx.type === "credit" ? (
                              <Badge className="bg-green-500 gap-1"><ArrowUpCircle className="h-3 w-3" /> Credit</Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1"><ArrowDownCircle className="h-3 w-3" /> Debit</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">৳{Number(tx.amount).toFixed(2)}</TableCell>
                          <TableCell>৳{Number(tx.balance_after).toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tx.description || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{sa.noTransactions}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── SMS History Tab ──────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> SMS History
              </CardTitle>
              <CardDescription>
                Full SMS delivery log across all tenants. Filter by tenant, status, or search by phone/message.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Tenant</Label>
                  <select
                    value={historyTenant}
                    onChange={(e) => setHistoryTenant(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">All Tenants</option>
                    {wallets.map((w: any) => (
                      <option key={w.tenant_id} value={w.tenant_id}>{w.tenant_name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-[160px]">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <select
                    value={historyStatus}
                    onChange={(e) => setHistoryStatus(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-xs text-muted-foreground">Search (phone / message)</Label>
                  <Input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="01XXXXXXXXX or text..."
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => refetchHistory()}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                  </Button>
                </div>
              </div>

              {/* Table */}
              {historyLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {smsHistory.map((log: any) => {
                        const tenantName = wallets.find((w: any) => w.tenant_id === log.tenant_id)?.tenant_name
                          ?? (log.tenant_id ? log.tenant_id.substring(0, 8) : "—");
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {log.created_at ? format(new Date(log.created_at), "dd MMM yy HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-sm">{tenantName}</TableCell>
                            <TableCell className="font-mono text-xs">{log.phone}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{log.sms_type}</Badge></TableCell>
                            <TableCell className="max-w-xs truncate text-sm" title={log.message}>{log.message}</TableCell>
                            <TableCell className="text-center">{log.sms_count || 1}</TableCell>
                            <TableCell>
                              <Badge variant={log.status === "sent" ? "default" : log.status === "failed" ? "destructive" : "secondary"}>
                                {log.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {smsHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No SMS history found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Showing latest {smsHistory.length} records.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings Tab ─────────────────────── */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" /> {sa.globalSmsGateway}
              </CardTitle>
              <CardDescription>This API is used to send SMS for all tenants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{sa.apiToken}</Label>
                      <Input type="password" value={form?.api_token || ""}
                        onChange={(e) => setForm({ ...form, api_token: e.target.value })}
                        placeholder="GreenWeb API Token" />
                    </div>
                    <div className="space-y-2">
                      <Label>{sa.senderId}</Label>
                      <Input value={form?.sender_id || ""}
                        onChange={(e) => setForm({ ...form, sender_id: e.target.value })}
                        placeholder="SmartISP" />
                    </div>
                    <div className="space-y-2">
                      <Label>{sa.adminCostRate}</Label>
                      <Input type="number" value={form?.admin_cost_rate ?? ""}
                        onChange={(e) => setForm({ ...form, admin_cost_rate: parseFloat(e.target.value) || 0 })}
                        placeholder="0.25" min="0" step="0.01" />
                      <p className="text-xs text-muted-foreground">Your actual GreenWeb cost per SMS unit</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      { key: "sms_on_bill_generate", label: sa.billGenerationSms },
                      { key: "sms_on_payment", label: sa.paymentConfirmationSms },
                      { key: "sms_on_registration", label: sa.newRegistrationSms },
                      { key: "sms_on_suspension", label: sa.accountSuspensionSms },
                      { key: "sms_on_new_customer_bill", label: sa.newCustomerBillSms },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-2 rounded border border-border">
                        <span className="text-sm">{item.label}</span>
                        <Switch checked={form?.[item.key] ?? false}
                          onCheckedChange={(v) => setForm({ ...form, [item.key]: v })} />
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {sa.saveGatewaySettings}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Recharge Dialog ────────────────────── */}
      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sa.rechargeSmsBalanceTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="font-medium">{selectedTenant?.tenant_name}</p>
              <p className="text-sm text-muted-foreground">
                Current Balance: <span className="font-bold">৳{Number(selectedTenant?.balance || 0).toFixed(2)}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Current Rate: <span className="font-bold">৳{Number(selectedTenant?.sms_rate ?? 0.50).toFixed(2)}/SMS</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>{sa.rechargeAmountLabel}</Label>
              <Input type="number" value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                placeholder="e.g., 500" min="1" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>{sa.smsRateLabel}</Label>
              <Input type="number" value={smsRateInput}
                onChange={(e) => setSmsRateInput(e.target.value)}
                placeholder={`Current: ৳${Number(selectedTenant?.sms_rate ?? 0.50).toFixed(2)}`}
                min="0.01" step="0.01" />
              <p className="text-xs text-muted-foreground">Leave empty to keep current rate</p>
            </div>
            <div className="space-y-2">
              <Label>{sa.descriptionOptional}</Label>
              <Input value={rechargeDesc}
                onChange={(e) => setRechargeDesc(e.target.value)}
                placeholder="e.g., Monthly recharge" />
            </div>
            <Button onClick={handleRecharge} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Recharge
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
