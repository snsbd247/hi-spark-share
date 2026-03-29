import { useState } from "react";
import { safeFormat } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import api from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Eye, EyeOff, Wifi, WifiOff, TestTube, Save, RefreshCw, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminRole } from "@/hooks/useAdminRole";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

const BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.mynagad.com:10061/remote-payment-gateway-1.0/api/dfs",
  live: "https://api.mynagad.com/api/dfs",
};

export default function NagadApiManagement() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { role } = useAdminRole();
  const isSuperAdmin = role === "super_admin";

  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  

  const [queryPaymentId, setQueryPaymentId] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [refundTxn, setRefundTxn] = useState<any>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const [form, setForm] = useState({
    app_key: "", app_secret: "", username: "", password: "",
    environment: "sandbox", merchant_number: "", base_url: BASE_URLS.sandbox,
  });
  const [formLoaded, setFormLoaded] = useState(false);

  // Fetch gateway config
  const { data: gateway, isLoading: loadingGateway } = useQuery({
    queryKey: ["payment-gateway-nagad"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_gateways")
        .select("*")
        .eq("gateway_name", "nagad")
        .maybeSingle();
      if (error) throw error;
      if (data && !formLoaded) {
        setForm({
          app_key: data.app_key || "",
          app_secret: data.app_secret || "",
          username: data.username || "",
          password: data.password || "",
          environment: data.environment || "sandbox",
          merchant_number: data.merchant_number || "",
          base_url: data.base_url || BASE_URLS.sandbox,
        });
        setFormLoaded(true);
      }
      return data;
    },
  });

  // Fetch recent Nagad transactions
  const { data: transactions, isLoading: loadingTxns } = useQuery({
    queryKey: ["nagad-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, customers(customer_id, name)")
        .eq("payment_method", "nagad")
        .order("paid_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch refund history
  const { data: refundLogs, isLoading: loadingRefunds } = useQuery({
    queryKey: ["nagad-refund-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action", "nagad_refund")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Save settings
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        gateway_name: "nagad",
        app_key: form.app_key,
        app_secret: form.app_secret,
        username: form.username,
        password: form.password,
        environment: form.environment,
        merchant_number: form.merchant_number,
        base_url: form.base_url,
        updated_at: new Date().toISOString(),
      };

      if (gateway?.id) {
        const { error } = await supabase.from("payment_gateways").update(payload).eq("id", gateway.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_gateways").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Nagad API settings saved");
      queryClient.invalidateQueries({ queryKey: ["payment-gateway-nagad"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Test connection
  const testMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/nagad/create-payment', { action: "test_connection" });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Nagad API connection successful!");
      queryClient.invalidateQueries({ queryKey: ["payment-gateway-nagad"] });
    },
    onError: (err: any) => toast.error(`Connection failed: ${err.message}`),
  });

  // Query transaction
  const queryTxnMutation = useMutation({
    mutationFn: async (paymentRefId: string) => {
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/nagad-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "query_transaction", paymentRefId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Query failed");
      return data;
    },
    onSuccess: (data) => {
      setQueryResult(data);
      if (data?.error) toast.error(data.error);
      else toast.success("Transaction details fetched");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Refund
  const refundMutation = useMutation({
    mutationFn: async (params: { paymentRefId: string; amount: string; reason: string }) => {
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/nagad-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "refund", ...params }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Refund failed");
      return data;
    },
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success("Refund processed successfully");
        setRefundTxn(null);
        setRefundAmount("");
        setRefundReason("");
        queryClient.invalidateQueries({ queryKey: ["nagad-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["nagad-refund-logs"] });
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleEnvChange = (env: string) => {
    setForm(f => ({ ...f, environment: env, base_url: BASE_URLS[env] || f.base_url }));
  };

  const openRefundDialog = (txn: any) => {
    setRefundTxn(txn);
    setRefundAmount(String(txn.amount));
    setRefundReason("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Nagad API Management</h1>
          <p className="text-muted-foreground text-sm">Manage Nagad payment gateway integration</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* API Status Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">API Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {gateway?.status === "connected" ? (
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Wifi className="h-5 w-5 text-green-600" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <WifiOff className="h-5 w-5 text-destructive" />
                  </div>
                )}
                <div>
                  <Badge variant={gateway?.status === "connected" ? "default" : "destructive"}>
                    {gateway?.status === "connected" ? "Connected" : "Not Connected"}
                  </Badge>
                  {gateway?.last_connected_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last connected: {safeFormat(gateway.last_connected_at, "dd MMM yyyy, hh:mm a")}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Environment</span>
                  <Badge variant="outline">{gateway?.environment || "—"}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merchant</span>
                  <span className="font-mono text-xs">{gateway?.merchant_number || "—"}</span>
                </div>
              </div>
              <Button className="w-full" variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending || !gateway?.app_key}>
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
            </CardContent>
          </Card>

          {/* API Configuration Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">API Configuration</CardTitle>
              <CardDescription>
                {isSuperAdmin ? "Configure Nagad API credentials (Merchant ID, PG Public Key, Merchant Private Key)" : "Only Super Admins can modify credentials"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingGateway ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Merchant ID / App Key</Label>
                    <Input value={form.app_key} onChange={e => setForm(f => ({ ...f, app_key: e.target.value }))} disabled={!isSuperAdmin} placeholder="Enter Merchant ID" />
                  </div>
                  <div className="space-y-2">
                    <Label>PG Public Key / App Secret</Label>
                    <div className="relative">
                      <Input type={showSecret ? "text" : "password"} value={form.app_secret} onChange={e => setForm(f => ({ ...f, app_secret: e.target.value }))} disabled={!isSuperAdmin} placeholder="Enter PG Public Key" />
                      <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!isSuperAdmin} placeholder="Enter Username" />
                  </div>
                  <div className="space-y-2">
                    <Label>Merchant Private Key / Password</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} disabled={!isSuperAdmin} placeholder="Enter Private Key" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select value={form.environment} onValueChange={handleEnvChange} disabled={!isSuperAdmin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Merchant Number</Label>
                    <Input value={form.merchant_number} onChange={e => setForm(f => ({ ...f, merchant_number: e.target.value }))} disabled={!isSuperAdmin} placeholder="01XXXXXXXXX" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Base URL</Label>
                    <Input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} disabled={!isSuperAdmin} className="font-mono text-xs" />
                  </div>
                  {isSuperAdmin && (
                    <div className="sm:col-span-2 flex justify-end">
                      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Settings
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Query & Refund Tool */}
        {isSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Query & Refund Tool
              </CardTitle>
              <CardDescription>Look up transaction status or initiate a refund via Nagad API</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="query">
                <TabsList className="mb-4">
                  <TabsTrigger value="query">Query Transaction</TabsTrigger>
                  <TabsTrigger value="refund">Refund</TabsTrigger>
                </TabsList>

                <TabsContent value="query">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Nagad Payment Reference ID</Label>
                      <Input value={queryPaymentId} onChange={e => setQueryPaymentId(e.target.value)} placeholder="Enter Nagad Payment Ref ID" className="font-mono text-sm" />
                    </div>
                    <Button onClick={() => queryTxnMutation.mutate(queryPaymentId)} disabled={queryTxnMutation.isPending || !queryPaymentId}>
                      {queryTxnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                      Query
                    </Button>
                  </div>
                  {queryResult && (
                    <div className="mt-4 rounded-lg border border-border p-4 space-y-2">
                      <h4 className="text-sm font-semibold mb-2">Query Result</h4>
                      {Object.entries(queryResult).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm border-b border-border pb-1.5 last:border-0">
                          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                          <span className="font-mono text-xs max-w-[60%] text-right break-all">{String(value ?? "—")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="refund">
                  <p className="text-sm text-muted-foreground mb-3">
                    Click the <Undo2 className="h-3.5 w-3.5 inline" /> icon on any completed transaction below to initiate a refund.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Payment Logs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Nagad Transactions</CardTitle>
              <CardDescription>Last 50 Nagad payment transactions</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["nagad-transactions"] })}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loadingTxns ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !transactions?.length ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No Nagad transactions found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer ID</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      {isSuperAdmin && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn: any) => (
                      <TableRow key={txn.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTxn(txn)}>
                        <TableCell className="text-xs">{safeFormat(txn.paid_at, "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-mono text-xs">{txn.customers?.customer_id || "—"}</TableCell>
                        <TableCell>{txn.customers?.name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{txn.transaction_id || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">৳{txn.amount}</TableCell>
                        <TableCell>
                          <Badge variant={txn.status === "completed" ? "default" : txn.status === "refunded" ? "outline" : "destructive"} className="text-xs">
                            {txn.status}
                          </Badge>
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            {txn.status === "completed" && txn.transaction_id && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openRefundDialog(txn); }}>
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Refund History */}
        {isSuperAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Undo2 className="h-4 w-4" />
                  Refund History
                </CardTitle>
                <CardDescription>All Nagad refund attempts with status</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["nagad-refund-logs"] })}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRefunds ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !refundLogs?.length ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No refund history found</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Payment Ref ID</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refundLogs.map((log: any) => {
                        const details = log.new_data as any;
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">{safeFormat(log.created_at, "dd MMM yyyy, hh:mm a")}</TableCell>
                            <TableCell className="font-mono text-xs">{log.record_id || "—"}</TableCell>
                            <TableCell className="text-xs">{details?.details || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={details?.status === "success" ? "default" : "destructive"} className="text-xs">
                                {details?.status || "unknown"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transaction Detail Dialog */}
        <Dialog open={!!selectedTxn} onOpenChange={(o) => !o && setSelectedTxn(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Transaction Details</DialogTitle></DialogHeader>
            {selectedTxn && (
              <div className="space-y-3">
                {[
                  ["Transaction ID", selectedTxn.transaction_id],
                  ["Amount", `৳${selectedTxn.amount}`],
                  ["Payment Method", selectedTxn.payment_method],
                  ["Customer ID", selectedTxn.customers?.customer_id],
                  ["Customer Name", selectedTxn.customers?.name],
                  ["Status", selectedTxn.status],
                  ["Date", safeFormat(selectedTxn.paid_at, "dd MMM yyyy, hh:mm a")],
                  ["Month", selectedTxn.month],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between border-b border-border pb-2">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium">{value || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Refund Dialog */}
        <Dialog open={!!refundTxn} onOpenChange={(o) => !o && setRefundTxn(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Refund Transaction</DialogTitle></DialogHeader>
            {refundTxn && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Transaction ID</span><span className="font-mono text-xs">{refundTxn.transaction_id}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Original Amount</span><span className="font-semibold">৳{refundTxn.amount}</span></div>
                </div>
                <div className="space-y-2">
                  <Label>Refund Amount (৳)</Label>
                  <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} max={refundTxn.amount} />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Reason for refund..." rows={2} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundTxn(null)}>{t.common.cancel}</Button>
              <Button
                variant="destructive"
                disabled={refundMutation.isPending || !refundAmount || Number(refundAmount) <= 0}
                onClick={() => refundTxn && refundMutation.mutate({
                  paymentRefId: refundTxn.transaction_id,
                  amount: refundAmount,
                  reason: refundReason,
                })}
              >
                {refundMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
                Process Refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
