import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Save, Settings, Plus, MessageSquare, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SuperSmsManagement() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeDesc, setRechargeDesc] = useState("");
  const [selectedTenantTx, setSelectedTenantTx] = useState<string | null>(null);

  // Global SMS Settings
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

  // SMS Wallets (all tenants)
  const { data: wallets = [], isLoading: walletsLoading } = useQuery({
    queryKey: ["super-sms-wallets"],
    queryFn: async () => {
      // Get all tenants
      const { data: tenants } = await db.from("tenants").select("id, name, subdomain, status").order("name");
      // Get all wallets
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

  // SMS Transactions
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["super-sms-transactions", selectedTenantTx],
    queryFn: async () => {
      let query = db.from("sms_transactions").select("*").order("created_at", { ascending: false }).limit(100);
      if (selectedTenantTx) {
        query = query.eq("tenant_id", selectedTenantTx);
      }
      const { data } = await query;
      return data || [];
    },
  });

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
      // Ensure wallet exists
      const { data: existing } = await db
        .from("sms_wallets")
        .select("id, balance")
        .eq("tenant_id", selectedTenant.tenant_id)
        .maybeSingle();

      let newBalance: number;

      if (existing) {
        newBalance = existing.balance + amount;
        await db.from("sms_wallets").update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        newBalance = amount;
        await db.from("sms_wallets").insert({
          tenant_id: selectedTenant.tenant_id,
          balance: amount,
        });
      }

      // Log transaction
      await db.from("sms_transactions").insert({
        tenant_id: selectedTenant.tenant_id,
        amount: amount,
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

  const totalBalance = wallets.reduce((sum: number, w: any) => sum + (w.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SMS Management</h1>
        <p className="text-muted-foreground">Global SMS gateway configuration & tenant balance management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Tenants</div>
            <div className="text-2xl font-bold">{wallets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total SMS Balance</div>
            <div className="text-2xl font-bold text-primary">{totalBalance.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Gateway Status</div>
            <div className="text-2xl font-bold">
              {smsSettings?.api_token ? (
                <Badge className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="destructive">Not Configured</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Global SMS Settings */}
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

              {/* SMS Event Toggles */}
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

      {/* Tenant SMS Wallets */}
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
                      <span className={`font-bold ${w.balance > 0 ? "text-green-600" : "text-destructive"}`}>
                        {w.balance.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTenant(w);
                            setRechargeOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Recharge
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTenantTx(
                            selectedTenantTx === w.tenant_id ? null : w.tenant_id
                          )}
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
              {selectedTenantTx && (
                <Badge variant="outline" className="ml-2">
                  {wallets.find((w: any) => w.tenant_id === selectedTenantTx)?.tenant_name}
                </Badge>
              )}
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

      {/* Recharge Dialog */}
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
