import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { postToLedger } from "@/lib/ledger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, BookOpen } from "lucide-react";

interface JournalLine {
  account_id: string;
  debit: number;
  credit: number;
}

export default function JournalEntries() {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: "", debit: 0, credit: 0 },
    { account_id: "", debit: 0, credit: 0 },
  ]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-flat"],
    queryFn: async () => {
      const { data } = await ( supabase as any).from("accounts").select("*").order("code", { ascending: true });
      return data || [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: { description: string; entries: JournalLine[]; date: string }) => {
      const totalDebit = data.entries.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredit = data.entries.reduce((s, l) => s + (Number(l.credit) || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error("Debit and Credit must be equal");
      }

      // Generate journal reference once for all lines
      const journalRef = `JE-${Date.now()}`;

      // Post each line to ledger
      for (const entry of data.entries) {
        if (!entry.account_id) continue;
        await postToLedger({
          description: data.description || "Journal Entry",
          account_id: entry.account_id,
          debit: Number(entry.debit) || 0,
          credit: Number(entry.credit) || 0,
          type: "journal",
          reference: journalRef,
          date: data.date,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-flat"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["all-transactions-summary"] });
      toast.success("Journal entry posted successfully");
      setLines([{ account_id: "", debit: 0, credit: 0 }, { account_id: "", debit: 0, credit: 0 }]);
      setDescription("");
    },
    onError: (e: any) => toast.error(e.message || "Failed to create journal entry"),
  });

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const updateLine = (i: number, field: keyof JournalLine, value: string | number) => {
    const updated = [...lines];
    (updated[i] as any)[field] = value;
    setLines(updated);
  };

  const addLine = () => setLines([...lines, { account_id: "", debit: 0, credit: 0 }]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(lines.filter((_, idx) => idx !== i)); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) { toast.error("Debit and Credit must be equal"); return; }
    mutation.mutate({ description, entries: lines, date });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-6 w-6" /> Journal Entries</h1>
          <p className="text-muted-foreground text-sm">Create double-entry journal entries</p>
        </div>

        <Card>
          <CardHeader><CardTitle>New Journal Entry</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Journal entry description..." rows={1} />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Account</TableHead>
                    <TableHead className="text-right">Debit (৳)</TableHead>
                    <TableHead className="text-right">Credit (৳)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select value={line.account_id || "none"} onValueChange={v => updateLine(i, "account_id", v === "none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" disabled>Select account</SelectItem>
                            {accounts.map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" value={line.debit || ""} onChange={e => updateLine(i, "debit", Number(e.target.value))} className="text-right" placeholder="0.00" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" value={line.credit || ""} onChange={e => updateLine(i, "credit", Number(e.target.value))} className="text-right" placeholder="0.00" />
                      </TableCell>
                      <TableCell>
                        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono">৳{totalDebit.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">৳{totalCredit.toFixed(2)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
                <div className="flex items-center gap-3">
                  {!isBalanced && totalDebit > 0 && (
                    <span className="text-sm text-destructive">Difference: ৳{Math.abs(totalDebit - totalCredit).toFixed(2)}</span>
                  )}
                  <Button type="submit" disabled={!isBalanced || mutation.isPending}>
                    {mutation.isPending ? "Posting..." : "Post Journal Entry"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
