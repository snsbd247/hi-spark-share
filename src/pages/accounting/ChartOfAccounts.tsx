import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ChevronRight, ChevronDown, Edit2, Trash2, FileText } from "lucide-react";
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
  is_system: boolean;
  is_active: boolean;
  all_children?: Account[];
}

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  liability: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  income: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expense: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  equity: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

function AccountRow({ account, expanded, onToggle, onEdit, onDelete, onAddChild, canEdit, canDelete }: {
  account: Account;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (a: Account) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, parentType: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const hasChildren = account.all_children && account.all_children.length > 0;
  const isOpen = expanded.has(account.id);

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
        <TableCell className="text-right font-mono">৳{Number(account.balance).toLocaleString("en-BD", { minimumFractionDigits: 2 })}</TableCell>
        <TableCell>
          <Badge variant={account.is_active ? "default" : "secondary"}>{account.is_active ? "Active" : "Inactive"}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onAddChild(account.id, account.type)} title="Add Sub-Account">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            {canEdit && !account.is_system && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(account)} title="Edit">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && !account.is_system && (
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
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}
    </>
  );
}

export default function ChartOfAccounts() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("accounting", "create");
  const canEdit = hasPermission("accounting", "edit");
  const canDelete = hasPermission("accounting", "delete");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", type: "asset", code: "", parent_id: "", description: "" });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: () => api.get("/accounting/chart-of-accounts").then(r => r.data),
  });

  const { data: flatAccounts = [] } = useQuery({
    queryKey: ["accounts-flat"],
    queryFn: () => api.get("/accounting/accounts?flat=true").then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editAccount
      ? api.put(`/accounting/accounts/${editAccount.id}`, data)
      : api.post("/accounting/accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-flat"] });
      toast.success(editAccount ? "Account updated" : "Account created");
      resetForm();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounting/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-flat"] });
      toast.success("Account deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Failed"),
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

  // Summary
  const totalsByType = flatAccounts.reduce((acc: Record<string, number>, a: any) => {
    acc[a.type] = (acc[a.type] || 0) + Number(a.balance);
    return acc;
  }, {});

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
                              <SelectItem key={a.id} value={a.id}>{"─".repeat(a.level)} {a.name} ({a.code})</SelectItem>
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
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : accounts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No accounts found</TableCell></TableRow>
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
                      canEdit={canEdit}
                      canDelete={canDelete}
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
