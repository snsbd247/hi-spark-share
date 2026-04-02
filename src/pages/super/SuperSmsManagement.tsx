import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from "recharts";
import {
  Loader2, Save, Settings, Plus, MessageSquare, ArrowUpCircle, ArrowDownCircle,
  Wifi, WifiOff, AlertTriangle, TrendingUp, Activity, Zap, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfDay } from "date-fns";

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
};

export default function SuperSmsManagement() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeDesc, setRechargeDesc] = useState("");
  const [selectedTenantTx, setSelectedTenantTx] = useState<string | null>(null);

  // ── Global SMS Settings ─────────────────────
  const { data: smsSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["super-sms-settings"],
    queryFn: async () => {
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
    if (Array.isArray(balArr) && balArr.length > 0) {
      const item = balArr[0];
      // GreenWeb returns balance as string, normalize
      return {
        ...item,
        balance: item.balance ?? item.remaining ?? item.credit ?? null,
        expire_date: item.expire_date ?? item.expiry ?? item.expire ?? null,
        rate: item.rate ?? item.sms_rate ?? null,
      };
    }
    if (typeof balArr === 'object' && balArr !== null) {
      return {
        ...balArr,
        balance: balArr.balance ?? balArr.remaining ?? balArr.credit ?? null,
        expire_date: balArr.expire_date ?? balArr.expiry ?? balArr.expire ?? null,
      };
    }
    return null;
  }, [liveBalance]);

  // Sent/Failed from API (not DB)
  const apiSent30 = liveBalance?.sent_30_days ?? null;
  const apiFailed30 = liveBalance?.failed_30_days ?? null;

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
        wallet_id: walletMap[t.id]?.id || null,
      }));
    },
  });

  // ── SMS Logs for Analytics ──────────────────
  const { data: smsLogs = [] } = useQuery({
    queryKey: ["super-sms-logs-analytics"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data } = await db
        .from("sms_logs")
        .select("id, created_at, status, sms_type, tenant_id, sms_count")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // ── Daily Usage Chart Data ──────────────────
  const dailyUsage = useMemo(() => {
    const map: Record<string, { date: string; sent: number; failed: number; total: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      map[d] = { date: d, sent: 0, failed: 0, total: 0 };
    }
    smsLogs.forEach((log: any) => {
      const d = format(new Date(log.created_at), "yyyy-MM-dd");
      if (map[d]) {
        map[d].total += (log.sms_count || 1);
        if (log.status === "sent") map[d].sent += (log.sms_count || 1);
        else map[d].failed += (log.sms_count || 1);
      }
    });
    return Object.values(map);
  }, [smsLogs]);

  // ── Per-Tenant Consumption ──────────────────
  const tenantConsumption = useMemo(() => {
    const map: Record<string, { tenant_id: string; total: number }> = {};
    smsLogs.forEach((log: any) => {
      const tid = log.tenant_id || "unknown";
      if (!map[tid]) map[tid] = { tenant_id: tid, total: 0 };
      map[tid].total += (log.sms_count || 1);
    });
    const result = Object.values(map).sort((a, b) => b.total - a.total);
    // Map tenant names
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

  // ── Stats ───────────────────────────────────
  const totalBalance = wallets.reduce((sum: number, w: any) => sum + (w.balance || 0), 0);
  const totalSent = smsLogs.filter((l: any) => l.status === "sent").length;
  const totalFailed = smsLogs.filter((l: any) => l.status === "failed").length;

  // ── Handlers ────────────────────────────────
  const handleSaveSettings = async () => {
    if (!form) return;
    setSaving(true);
    try {
      if (smsSettings?.id) {
        await db.from("sms_settings").update({
          api_token: form.api_token,
          sender_id: form.sender_id,
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
      } else {
        await db.from("sms_settings").insert({
          api_token: form.api_token,
          sender_id: form.sender_id,
        });
      }
      toast.success("Global SMS settings saved");
      qc.invalidateQueries({ queryKey: ["super-sms-settings"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecharge = async () => {
    if (!selectedTenant || !rechargeAmount) return;
    const amount = parseInt(rechargeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      const { data: existing } = await db.from("sms_wallets").select("id, balance").eq("tenant_id", selectedTenant.tenant_id).maybeSingle();
      let newBalance: number;
      if (existing) {
        newBalance = existing.balance + amount;
        await db.from("sms_wallets").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        newBalance = amount;
        await db.from("sms_wallets").insert({ tenant_id: selectedTenant.tenant_id, balance: amount });
      }
      await db.from("sms_transactions").insert({
        tenant_id: selectedTenant.tenant_id,
        amount,
        type: "credit",
        description: rechargeDesc || "SMS Recharge by Super Admin",
        admin_id: "super_admin",
        balance_after: newBalance,
      });
      toast.success(`Recharged ${amount} SMS to ${selectedTenant.tenant_name}`);
      setRechargeOpen(false);
      setRechargeAmount("");
      setRechargeDesc("");
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
        <h1 className="text-2xl font-bold text-foreground">SMS Management</h1>
        <p className="text-muted-foreground">Global SMS gateway, analytics & tenant balance management</p>
      </div>

      {/* ── Stats Row ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Live API Balance */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" /> Live API Balance
                </div>
                {balanceLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mt-1" />
                ) : apiBalance ? (
                  <div className="text-2xl font-bold text-primary">
                    {apiBalance.balance ?? "N/A"}
                  </div>
                ) : (
                  <div className="text-lg font-semibold text-muted-foreground">—</div>
                )}
                {apiBalance?.expire_date && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Expires: {apiBalance.expire_date}
                  </div>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => refetchBalance()} className="h-8 w-8">
                <RefreshCw className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Total Tenant Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Total Tenant Balance
            </div>
            <div className="text-2xl font-bold">{totalBalance.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{wallets.length} tenants</div>
          </CardContent>
        </Card>

        {/* 30-Day Sent */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Sent (30 Days)
            </div>
            {balanceLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mt-1" />
            ) : apiSent30 !== null ? (
              <>
                <div className="text-2xl font-bold text-primary">{apiSent30.toLocaleString()}</div>
                {(apiFailed30 ?? 0) > 0 && (
                  <div className="text-xs text-destructive">{apiFailed30} failed</div>
                )}
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">{totalSent.toLocaleString()}</div>
                {totalFailed > 0 && (
                  <div className="text-xs text-destructive">{totalFailed} failed</div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Gateway Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> Gateway Status
            </div>
            <div className="mt-1">
              {smsSettings?.api_token ? (
                <Badge className="bg-green-600 text-white gap-1"><Wifi className="h-3 w-3" /> Active</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> Not Configured</Badge>
              )}
            </div>
            {apiBalance?.sms_rate && (
              <div className="text-xs text-muted-foreground mt-1">Rate: ৳{apiBalance.sms_rate}/SMS</div>
            )}
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
                  ⚠️ Low SMS Balance Alert — {lowBalanceTenants.length} tenant(s)
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lowBalanceTenants.map((t: any) => (
                    <Badge key={t.tenant_id} variant="outline" className="border-destructive/50 text-destructive gap-1">
                      {t.tenant_name}: {t.balance} SMS
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1 ml-1 text-xs"
                        onClick={() => { setSelectedTenant(t); setRechargeOpen(true); }}
                      >
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
          <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
          <TabsTrigger value="wallets">💰 Wallets</TabsTrigger>
          <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
        </TabsList>

        {/* ── Analytics Tab ────────────────────── */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Daily Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SMS Usage (Last 30 Days)</CardTitle>
              <CardDescription>Daily sent vs failed breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={dailyUsage} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(new Date(d), "dd MMM")}
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    labelFormatter={(d) => format(new Date(d), "dd MMM yyyy")}
                  />
                  <Area type="monotone" dataKey="sent" stackId="1" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.3)" name="Sent" />
                  <Area type="monotone" dataKey="failed" stackId="1" stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60% / 0.3)" name="Failed" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Per-Tenant Consumption */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tenant SMS Consumption (30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {tenantConsumption.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No SMS data</p>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={tenantConsumption.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        dataKey="tenant_name"
                        type="category"
                        width={100}
                        tick={{ fontSize: 11 }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Total SMS" />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* SMS Type Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SMS by Type (30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {typeBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No SMS data</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ChartContainer config={chartConfig} className="h-[220px] w-[220px] shrink-0">
                      <PieChart>
                        <Pie
                          data={typeBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
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

        {/* ── Wallets Tab ──────────────────────── */}
        <TabsContent value="wallets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Tenant SMS Balances
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
                      <TableHead className="text-right">SMS Balance</TableHead>
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
                          <span className={`font-bold ${w.balance < LOW_BALANCE_THRESHOLD ? "text-destructive" : "text-green-600"}`}>
                            {w.balance.toLocaleString()}
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedTenantTx(selectedTenantTx === w.tenant_id ? null : w.tenant_id)}
                            >
                              History
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {wallets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No tenants found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Transaction History */}
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
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance After</TableHead>
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
                          <TableCell className="font-medium">{tx.amount}</TableCell>
                          <TableCell>{tx.balance_after}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tx.description || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No transactions</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Settings Tab ─────────────────────── */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" /> Global SMS Gateway (GreenWeb)
              </CardTitle>
              <CardDescription>This API is used to send SMS for all tenants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settingsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>API Token</Label>
                      <Input
                        type="password"
                        value={form?.api_token || ""}
                        onChange={(e) => setForm({ ...form, api_token: e.target.value })}
                        placeholder="GreenWeb API Token"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sender ID</Label>
                      <Input
                        value={form?.sender_id || ""}
                        onChange={(e) => setForm({ ...form, sender_id: e.target.value })}
                        placeholder="SmartISP"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      { key: "sms_on_bill_generate", label: "Bill Generation SMS" },
                      { key: "sms_on_payment", label: "Payment Confirmation SMS" },
                      { key: "sms_on_registration", label: "New Registration SMS" },
                      { key: "sms_on_suspension", label: "Account Suspension SMS" },
                      { key: "sms_on_new_customer_bill", label: "New Customer Bill SMS" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-2 rounded border border-border">
                        <span className="text-sm">{item.label}</span>
                        <Switch
                          checked={form?.[item.key] ?? false}
                          onCheckedChange={(v) => setForm({ ...form, [item.key]: v })}
                        />
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Gateway Settings
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
            <DialogTitle>Recharge SMS Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="font-medium">{selectedTenant?.tenant_name}</p>
              <p className="text-sm text-muted-foreground">
                Current Balance: <span className="font-bold">{selectedTenant?.balance || 0} SMS</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Recharge Amount (SMS Count)</Label>
              <Input
                type="number"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                placeholder="e.g., 500"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                value={rechargeDesc}
                onChange={(e) => setRechargeDesc(e.target.value)}
                placeholder="e.g., Monthly recharge"
              />
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
