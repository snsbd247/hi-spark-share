import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, RefreshCcw } from "lucide-react";
import { format } from "date-fns";

export default function WalletManagement() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "", amount: "", gateway: "manual", description: "" });

  const { data: walletsResp, isLoading } = useQuery({
    queryKey: ["wallet-customers"],
    queryFn: async () => (await api.get("/wallet/customers")).data,
  });

  const { data: history } = useQuery({
    queryKey: ["wallet-history"],
    queryFn: async () => (await api.get("/wallet/history?per_page=20")).data,
  });

  const credit = useMutation({
    mutationFn: async () => (await api.post("/wallet/credit", { ...form, amount: Number(form.amount) })).data,
    onSuccess: () => {
      toast.success("Wallet credited");
      qc.invalidateQueries({ queryKey: ["wallet-customers"] });
      qc.invalidateQueries({ queryKey: ["wallet-history"] });
      setOpen(false);
      setForm({ customer_id: "", amount: "", gateway: "manual", description: "" });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to credit"),
  });

  const wallets = walletsResp?.data || [];
  const txns = history?.data || [];
  const totalBalance = wallets.reduce((s: number, w: any) => s + parseFloat(w.balance || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Customer Wallets
          </h1>
          <p className="text-muted-foreground mt-1">Manage customer wallet balances and transactions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Credit Wallet</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Credit Customer Wallet</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Customer ID (UUID)</Label>
                <Input value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} />
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Source</Label>
                <Select value={form.gateway} onValueChange={(v) => setForm({ ...form, gateway: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bkash">bKash</SelectItem>
                    <SelectItem value="nagad">Nagad</SelectItem>
                    <SelectItem value="sslcommerz">SSLCommerz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => credit.mutate()} disabled={credit.isPending || !form.customer_id || !form.amount}>
                {credit.isPending ? "Processing..." : "Credit Wallet"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Wallet Balance</p>
          <p className="text-2xl font-bold text-primary">৳{totalBalance.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Active Wallets</p>
          <p className="text-2xl font-bold">{wallets.filter((w: any) => w.status === "active").length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Recent Transactions</p>
          <p className="text-2xl font-bold">{txns.length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Wallets</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Auto-Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : wallets.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No wallets yet</TableCell></TableRow>
              ) : wallets.map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell>{w.customer?.name || "—"}</TableCell>
                  <TableCell>{w.customer?.phone || "—"}</TableCell>
                  <TableCell className="font-medium text-primary">৳{parseFloat(w.balance).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={w.status === "active" ? "default" : "destructive"}>{w.status}</Badge></TableCell>
                  <TableCell>{w.auto_pay ? <Badge variant="default">ON</Badge> : <Badge variant="secondary">OFF</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["wallet-history"] })}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Badge variant={t.type === "credit" ? "default" : "destructive"} className="gap-1">
                      {t.type === "credit" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {t.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.customer?.name || "—"}</TableCell>
                  <TableCell className={t.type === "credit" ? "text-primary font-medium" : "text-destructive font-medium"}>
                    {t.type === "credit" ? "+" : "-"}৳{parseFloat(t.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>৳{parseFloat(t.balance_after).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.source}{t.gateway ? ` (${t.gateway})` : ""}</TableCell>
                  <TableCell className="text-xs">{format(new Date(t.created_at), "dd MMM HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
