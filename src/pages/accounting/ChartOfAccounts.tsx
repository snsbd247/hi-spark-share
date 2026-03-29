import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ChevronRight, ChevronDown, Edit2, Trash2, FileText, BookOpen } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface Account {
  id: string;
  name: string;
  type: string;
  code: string | null;
  parent_id: string | null;
  level: number;
  balance: number;
  description: string | null;
  is_system: boolean | null;
  is_active: boolean | null;
  status: string;
  all_children?: Account[];
  total_debit?: number;
  total_credit?: number;
  closing_balance?: number;
}

function buildTree(flat: Account[]): Account[] {
  const map = new Map<string, Account>();
  flat.forEach(a => map.set(a.id, { ...a, all_children: [] }));
  const roots: Account[] = [];
  map.forEach(a => {
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.all_children!.push(a);
    } else {
      roots.push(a);
    }
  });
  return roots;
}

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  liability: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  income: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expense: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  equity: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

function AccountRow({ account, expanded, onToggle, onEdit, onDelete, onAddChild, onViewStatement, canEdit, canDelete, isSuperAdmin }: {
  account: Account;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (a: Account) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, parentType: string) => void;
  onViewStatement: (a: Account) => void;
  canEdit: boolean;
  canDelete: boolean;
  isSuperAdmin: boolean;
}) {
  const hasChildren = account.all_children && account.all_children.length > 0;
  const isOpen = expanded.has(account.id);
  const fmt = (v: number) => `৳${Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

  return (
    <>
      <TableRow className={account.level === 0 ? "bg-muted/30 font-semibold" : ""}>
        <TableCell>
          <div className="flex items-center" style={{ paddingLeft: `${account.level * 24}px` }}>
            {hasChildren ? (
              <button onClick={() => onToggle(account.id)} className="mr-2 p-0.5 hover:bg-muted rounded">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="mr-2 w-5" />
            )}
            <span>{account.name}</span>
          </div>
        </TableCell>
        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{account.code || "—"}</code></TableCell>
        <TableCell><Badge variant="outline" className={TYPE_COLORS[account.type] || ""}>{account.type}</Badge></TableCell>
        <TableCell className="text-right font-mono text-sm">{fmt(account.total_debit || 0)}</TableCell>
        <TableCell className="text-right font-mono text-sm">{fmt(account.total_credit || 0)}</TableCell>
        <TableCell className={`text-right font-mono font-semibold ${(account.closing_balance || 0) < 0 ? "text-destructive" : ""}`}>
          {fmt(account.closing_balance || 0)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center gap-0.5 justify-end">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onViewStatement(account)} title="View Ledger Statement">
              <BookOpen className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onAddChild(account.id, account.type)} title="Add Sub-Account">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            {canEdit && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(account)} title="Edit">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (isSuperAdmin || !account.is_system) && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(account.id)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {isOpen && hasChildren && account.all_children!.map((child) => (
        <AccountRow
          key={child.id}
          account={child}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onViewStatement={onViewStatement}
          canEdit={canEdit}
          canDelete={canDelete}
          isSuperAdmin={isSuperAdmin}
        />
      ))}
    </>
  );
}

export default function ChartOfAccounts() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreate = hasPermission("accounting", "create");
  const canEdit = hasPermission("accounting", "edit");
  const canDelete = hasPermission("accounting", "delete");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", type: "asset", code: "", parent_id: "", description: "" });

  // Fetch accounts
  const { data: flatAccounts = [], isLoading } = useQuery({
    queryKey: ["accounts-flat"],
    queryFn: async () => {
      const res = await ( supabase as any).from("accounts").select("*").order("code", { ascending: true }).order("name", { ascending: true });
      return res.data || [];
    },
  });

  // Fetch all transactions to compute debit/credit per account
  const { data: transactions = [] } = useQuery({
    queryKey: ["all-transactions-summary"],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("transactions").select("account_id, debit, credit");
      return data || [];
    },
  });

  // Compute debit/credit totals per account
  const accountTotals = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    transactions.forEach((t: any) => {
      if (!t.account_id) return;
      const existing = map.get(t.account_id) || { debit: 0, credit: 0 };
      existing.debit += Number(t.debit || 0);
      existing.credit += Number(t.credit || 0);
      map.set(t.account_id, existing);
    });
    return map;
  }, [transactions]);

  // Enrich accounts with debit/credit/closing balance, aggregating children into parents
  const enrichedAccounts = useMemo(() => {
    // Step 1: Compute own totals per account
    const ownTotals = new Map<string, { debit: number; credit: number }>();
    flatAccounts.forEach((a: any) => {
      const totals = accountTotals.get(a.id) || { debit: 0, credit: 0 };
      ownTotals.set(a.id, { ...totals });
    });

    // Step 2: Build parent-child map and aggregate bottom-up
    const childrenMap = new Map<string, string[]>();
    flatAccounts.forEach((a: any) => {
      if (a.parent_id) {
        const siblings = childrenMap.get(a.parent_id) || [];
        siblings.push(a.id);
        childrenMap.set(a.parent_id, siblings);
      }
    });

    // Recursive function to get aggregated totals (own + all descendants)
    const aggregated = new Map<string, { debit: number; credit: number }>();
    const getAggregated = (id: string): { debit: number; credit: number } => {
      if (aggregated.has(id)) return aggregated.get(id)!;
      const own = ownTotals.get(id) || { debit: 0, credit: 0 };
      const result = { debit: own.debit, credit: own.credit };
      const children = childrenMap.get(id) || [];
      for (const childId of children) {
        const childTotals = getAggregated(childId);
        result.debit += childTotals.debit;
        result.credit += childTotals.credit;
      }
      aggregated.set(id, result);
      return result;
    };

    return flatAccounts.map((a: any) => {
      const totals = getAggregated(a.id);
      const isDebitNormal = ["asset", "expense"].includes(a.type);
      const closingBalance = isDebitNormal
        ? totals.debit - totals.credit
        : totals.credit - totals.debit;
      return {
        ...a,
        total_debit: totals.debit,
        total_credit: totals.credit,
        closing_balance: closingBalance,
      };
    });
  }, [flatAccounts, accountTotals]);

  const accounts = useMemo(() => buildTree(enrichedAccounts), [enrichedAccounts]);

  // Summary totals by type
  const totalsByType = enrichedAccounts.reduce((acc: Record<string, number>, a: any) => {
    acc[a.type] = (acc[a.type] || 0) + (a.closing_balance || 0);
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const level = data.parent_id ? (flatAccounts.find((a: Account) => a.id === data.parent_id)?.level ?? -1) + 1 : 0;
      const payload = { ...data, level, parent_id: data.parent_id || null };
      if (editAccount) {
        return ( supabase as any).from("accounts").update(payload).eq("id", editAccount.id);
      }
      return ( supabase as any).from("accounts").insert(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-flat"] });
      toast.success(editAccount ? "Account updated" : "Account created");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => ( supabase as any).from("accounts").delete().eq("id", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-flat"] });
      toast.success("Account deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditAccount(null);
    setForm({ name: "", type: "asset", code: "", parent_id: "", description: "" });
  };

  const handleEdit = (acc: Account) => {
    setEditAccount(acc);
    setForm({ name: acc.name, type: acc.type, code: acc.code || "", parent_id: acc.parent_id || "", description: acc.description || "" });
    setDialogOpen(true);
  };

  const handleAddChild = (parentId: string, parentType: string) => {
    setEditAccount(null);
    setForm({ name: "", type: parentType, code: "", parent_id: parentId, description: "" });
    setDialogOpen(true);
  };

  const handleViewStatement = (acc: Account) => {
    navigate(`/accounting/ledger-statement?account_id=${acc.id}&name=${encodeURIComponent(acc.name)}&code=${encodeURIComponent(acc.code || "")}`);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collect = (items: Account[]) => {
      items.forEach(a => { allIds.add(a.id); if (a.all_children) collect(a.all_children); });
    };
    collect(accounts);
    setExpanded(allIds);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6" /> Chart of Accounts
            </h1>
            <p className="text-muted-foreground text-sm">Hierarchical account structure with double-entry support</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>Collapse All</Button>
            {canCreate && (
              <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editAccount ? "Edit Account" : "Add Account"}</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Account Name *</Label>
                        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                      </div>
                      <div>
                        <Label>Account Code</Label>
                        <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1001" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type *</Label>
                        <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asset">Asset</SelectItem>
                            <SelectItem value="liability">Liability</SelectItem>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="equity">Equity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Parent Account</Label>
                        <Select value={form.parent_id || "none"} onValueChange={v => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="None (Root)" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (Root Level)</SelectItem>
                            {flatAccounts.map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>{"─".repeat(a.level || 0)} {a.name} ({a.code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                      <Button type="submit" disabled={saveMutation.isPending}>{editAccount ? "Update" : "Create"}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {["asset", "liability", "equity", "income", "expense"].map(type => (
            <Card key={type}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground capitalize">{type}s</p>
                <p className="text-lg font-bold">৳{(totalsByType[type] || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Account Tree Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total Debit</TableHead>
                  <TableHead className="text-right">Total Credit</TableHead>
                  <TableHead className="text-right">Closing Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : accounts.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No accounts found</TableCell></TableRow>
                ) : (
                  accounts.map((acc: Account) => (
                    <AccountRow
                      key={acc.id}
                      account={acc}
                      expanded={expanded}
                      onToggle={toggleExpand}
                      onEdit={handleEdit}
                      onDelete={(id) => { if (confirm("Delete this account?")) deleteMutation.mutate(id); }}
                      onAddChild={handleAddChild}
                      onViewStatement={handleViewStatement}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      isSuperAdmin={isSuperAdmin}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
