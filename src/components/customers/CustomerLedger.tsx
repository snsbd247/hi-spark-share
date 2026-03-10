import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/apiDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Printer, FileDown, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface Props {
  customerId: string;
  customerName: string;
}

const PAGE_SIZE = 20;

export default function CustomerLedger({ customerId, customerName }: Props) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ description: "", amount: "", type: "debit" as "debit" | "credit" });
  const [saving, setSaving] = useState(false);

  const { data: ledger, isLoading } = useQuery({
    queryKey: ["customer-ledger", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_ledger" as any)
        .select("*")
        .eq("customer_id", customerId)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!ledger) return [];
    return ledger.filter((entry: any) => {
      if (typeFilter !== "all" && entry.type !== typeFilter) return false;
      if (dateFrom && new Date(entry.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(entry.date) > new Date(dateTo + "T23:59:59")) return false;
      if (search && !entry.description.toLowerCase().includes(search.toLowerCase()) && !(entry.reference || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [ledger, typeFilter, dateFrom, dateTo, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const typeBadge = (type: string) => {
    switch (type) {
      case "bill": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Bill</Badge>;
      case "payment": return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Payment</Badge>;
      default: return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Adjustment</Badge>;
    }
  };

  const handleAdjustment = async () => {
    if (!adjustForm.description || !adjustForm.amount) {
      toast.error("Fill all fields"); return;
    }
    setSaving(true);
    try {
      const amount = parseFloat(adjustForm.amount);
      if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }

      const prevBalance = ledger?.length
        ? Number((ledger[ledger.length - 1] as any).balance)
        : 0;

      const debit = adjustForm.type === "debit" ? amount : 0;
      const credit = adjustForm.type === "credit" ? amount : 0;
      const balance = prevBalance + debit - credit;

      const { error } = await supabase.from("customer_ledger" as any).insert({
        customer_id: customerId,
        description: adjustForm.description,
        debit,
        credit,
        balance,
        reference: "ADJ-MANUAL",
        type: "adjustment",
      } as any);
      if (error) throw error;
      toast.success("Adjustment added");
      setAdjustOpen(false);
      setAdjustForm({ description: "", amount: "", type: "debit" });
      queryClient.invalidateQueries({ queryKey: ["customer-ledger", customerId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Customer Ledger - ${customerName}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 28);

    let y = 38;
    const headers = ["Date", "Description", "Debit", "Credit", "Balance", "Ref"];
    const colX = [14, 40, 100, 125, 150, 175];

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 6;
    doc.setFont("helvetica", "normal");

    filtered.forEach((entry: any) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(format(new Date(entry.date), "dd/MM/yyyy"), colX[0], y);
      doc.text(entry.description.substring(0, 30), colX[1], y);
      doc.text(Number(entry.debit) > 0 ? `৳${Number(entry.debit).toLocaleString()}` : "", colX[2], y);
      doc.text(Number(entry.credit) > 0 ? `৳${Number(entry.credit).toLocaleString()}` : "", colX[3], y);
      doc.text(`৳${Number(entry.balance).toLocaleString()}`, colX[4], y);
      doc.text((entry.reference || "").substring(0, 12), colX[5], y);
      y += 5;
    });

    doc.save(`ledger-${customerName.replace(/\s+/g, "-")}.pdf`);
  };

  const printLedger = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = filtered.map((e: any) => `
      <tr>
        <td>${format(new Date(e.date), "dd/MM/yyyy")}</td>
        <td>${e.description}</td>
        <td style="text-align:right">${Number(e.debit) > 0 ? `৳${Number(e.debit).toLocaleString()}` : ""}</td>
        <td style="text-align:right">${Number(e.credit) > 0 ? `৳${Number(e.credit).toLocaleString()}` : ""}</td>
        <td style="text-align:right">৳${Number(e.balance).toLocaleString()}</td>
        <td>${e.reference || ""}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <html><head><title>Ledger - ${customerName}</title>
      <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px}th{background:#f5f5f5}</style>
      </head><body>
      <h2>Customer Ledger - ${customerName}</h2>
      <table><thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Reference</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.print();window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Customer Ledger</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adjustment
            </Button>
            <Button variant="outline" size="sm" onClick={printLedger}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative max-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="bill">Bills</SelectItem>
              <SelectItem value="payment">Payments</SelectItem>
              <SelectItem value="adjustment">Adjustments</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="w-[150px] h-9 text-sm" />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="w-[150px] h-9 text-sm" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No ledger entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{format(new Date(entry.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-sm">{entry.description}</TableCell>
                        <TableCell>{typeBadge(entry.type)}</TableCell>
                        <TableCell className="text-right text-sm text-destructive font-medium">
                          {Number(entry.debit) > 0 ? `৳${Number(entry.debit).toLocaleString()}` : ""}
                        </TableCell>
                        <TableCell className="text-right text-sm text-success font-medium">
                          {Number(entry.credit) > 0 ? `৳${Number(entry.credit).toLocaleString()}` : ""}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold">
                          ৳{Number(entry.balance).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">{entry.reference || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Manual Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Manual Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={adjustForm.type} onValueChange={(v) => setAdjustForm({ ...adjustForm, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit (Increase Due)</SelectItem>
                  <SelectItem value="credit">Credit (Decrease Due)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (৳)</Label>
              <Input type="number" value={adjustForm.amount} onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={adjustForm.description} onChange={(e) => setAdjustForm({ ...adjustForm, description: e.target.value })} placeholder="Reason for adjustment..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjustment} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Adjustment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
