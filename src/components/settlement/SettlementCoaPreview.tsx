import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

interface Account {
  id: string;
  code?: string | null;
  name: string;
  type?: string;
}

interface PreviewLine {
  side: "Dr" | "Cr";
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  amount: number;
  note: string;
}

interface PreviewData {
  settlement_id: string;
  employee?: { name?: string; employee_id?: string };
  month?: string;
  total_earn: number;
  total_deduction: number;
  net_payable: number;
  advance_used: number;
  accounts: {
    salary_expense?: Account | null;
    employee_payable?: Account | null;
    employee_advance?: Account | null;
    cash?: Account | null;
  };
  lines: PreviewLine[];
  totals: { debit: number; credit: number; balanced: boolean };
  ready: boolean;
}

export function SettlementCoaPreview({
  settlementId,
  open,
  onOpenChange,
  onConfirm,
  isConfirming,
}: {
  settlementId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (overrides: Record<string, string | undefined>) => void;
  isConfirming: boolean;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const { data: accounts } = useQuery<{ data?: Account[] } | Account[]>({
    queryKey: ["coa-accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
    enabled: open,
  });

  const { data, isLoading, refetch } = useQuery<PreviewData>({
    queryKey: ["settlement-preview", settlementId, overrides.cash_account_id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (overrides.cash_account_id) params.set("cash_account_id", overrides.cash_account_id);
      return (await api.get(`/employee/settlement/${settlementId}/preview?${params}`)).data;
    },
    enabled: !!settlementId && open,
  });

  const accList: Account[] = Array.isArray(accounts)
    ? accounts
    : accounts?.data || [];

  const renderRemap = (key: string, label: string, current?: Account | null) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select
        value={overrides[key] || current?.id || ""}
        onValueChange={(v) => {
          setOverrides((o) => ({ ...o, [key]: v }));
          if (key === "cash_account_id") setTimeout(() => refetch(), 50);
        }}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={current?.name || "Select account"} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {accList.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.code ? `${a.code} — ` : ""}{a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verify COA Mapping Before Posting</DialogTitle>
          <DialogDescription>
            Review the journal entries that will be posted to the ledger. You can remap accounts if needed.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Building preview…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Employee</div>
                <div className="font-medium">{data.employee?.name || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Month</div>
                <div className="font-medium">{data.month || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total earn</div>
                <div className="font-medium">৳{data.total_earn.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net payable</div>
                <div className="font-bold text-primary">৳{data.net_payable.toLocaleString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-md bg-muted/40">
              {renderRemap("salary_expense_id", "Salary Expense", data.accounts.salary_expense)}
              {renderRemap("payable_account_id", "Employee Payable", data.accounts.employee_payable)}
              {renderRemap("advance_account_id", "Employee Advance", data.accounts.employee_advance)}
              {renderRemap("cash_account_id", "Cash / Bank (paid from)", data.accounts.cash)}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Proposed Journal Entries</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Side</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge variant={l.side === "Dr" ? "default" : "secondary"}>{l.side}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.account_code ? `${l.account_code} — ` : ""}
                        {l.account_name || <span className="text-destructive">missing</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.side === "Dr" ? `৳${l.amount.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.side === "Cr" ? `৳${l.amount.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.note}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold border-t">
                    <TableCell colSpan={2}>Totals</TableCell>
                    <TableCell className="text-right">৳{data.totals.debit.toLocaleString()}</TableCell>
                    <TableCell className="text-right">৳{data.totals.credit.toLocaleString()}</TableCell>
                    <TableCell>
                      {data.totals.balanced ? (
                        <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Balanced</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Unbalanced</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {!data.ready && (
              <div className="p-3 rounded-md border border-destructive/50 bg-destructive/10 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>One or more required accounts are missing or entries are unbalanced. Please remap before confirming.</div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(overrides)}
            disabled={isConfirming || !data?.ready}
          >
            {isConfirming ? "Posting…" : "Confirm & Post Journal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
