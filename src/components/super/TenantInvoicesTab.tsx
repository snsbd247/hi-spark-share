import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { PDF_COLORS, PDF_FONT, PDF_SPACING, drawFooter } from "@/lib/pdfTheme";
import { getResolvedBranding, type BrandingData } from "@/lib/brandingHelper";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import {
  Receipt, Loader2, Printer, CheckCircle2, Edit, Trash2, Eye,
} from "lucide-react";

interface Props {
  tenantId: string;
  tenantName?: string;
}

export default function TenantInvoicesTab({ tenantId, tenantName }: Props) {
  const qc = useQueryClient();
  const queryKey = ["tenant-invoices", tenantId];

  const { data: invoices = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await (db.from as any)("subscription_invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["saas-plans-lookup"],
    queryFn: async () => {
      const { data } = await (db.from as any)("saas_plans").select("id, name, price_monthly, price_yearly, billing_cycle");
      return data || [];
    },
  });

  const getPlanName = (planId: string) => plans.find((p: any) => p.id === planId)?.name || "N/A";

  // ── Mark as Paid ──
  const markPaid = useMutation({
    mutationFn: async (invoiceId: string) => {
      const invoice = invoices.find((i: any) => i.id === invoiceId);
      if (!invoice) throw new Error("Invoice not found");

      await (db.from as any)("subscription_invoices").update({
        status: "paid",
        paid_date: new Date().toISOString(),
        payment_method: "manual",
      }).eq("id", invoiceId);

      const newExpiry = new Date();
      if (invoice.billing_cycle === "yearly") {
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      } else {
        newExpiry.setMonth(newExpiry.getMonth() + 1);
      }

      await (db.from as any)("tenants").update({
        plan_expire_date: newExpiry.toISOString().split("T")[0],
        plan_id: invoice.plan_id,
        status: "active",
      }).eq("id", invoice.tenant_id);

      await (db.from as any)("subscriptions").update({ status: "active" })
        .eq("tenant_id", invoice.tenant_id).eq("status", "expired");
    },
    onSuccess: () => {
      toast.success("Invoice marked as paid, plan extended!");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Edit ──
  const [editOpen, setEditOpen] = useState(false);
  const [editInv, setEditInv] = useState<any>(null);

  const editInvoice = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await (db.from as any)("subscription_invoices").update({
        amount: Number(form.amount),
        tax_amount: Number(form.tax_amount || 0),
        total_amount: Number(form.total_amount),
        billing_cycle: form.billing_cycle,
        due_date: form.due_date,
        notes: form.notes || null,
        status: form.status,
      }).eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice updated");
      setEditOpen(false);
      setEditInv(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Delete ──
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (db.from as any)("subscription_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice deleted");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Preview ──
  const [previewInv, setPreviewInv] = useState<any>(null);

  // ── Print PDF (Clean White Design with Branding) ──
  const generatePDF = async (invoice: any) => {
    try {
      const branding = await getResolvedBranding();
      generateCleanInvoicePDF(invoice, branding, tenantName);
      toast.success("Invoice downloaded");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + (err.message || "Unknown error"));
    }
  };

  // ── Status badge ──
  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      cancelled: "bg-muted text-muted-foreground",
    };
    return <Badge className={variants[status] || "bg-muted text-muted-foreground"}>{status?.toUpperCase()}</Badge>;
  };

  if (isLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Subscription Invoices ({invoices.length})
          </CardTitle>
          <CardDescription>All subscription invoices for this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground font-medium">No invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {inv.created_at ? format(new Date(inv.created_at), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{getPlanName(inv.plan_id)}</TableCell>
                      <TableCell className="capitalize text-sm">{inv.billing_cycle || "monthly"}</TableCell>
                      <TableCell className="text-right text-sm">Tk {Number(inv.amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">Tk {Number(inv.tax_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">Tk {Number(inv.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setPreviewInv(inv)}
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {inv.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary hover:bg-primary/10 h-8 px-2"
                              onClick={() => markPaid.mutate(inv.id)}
                              disabled={markPaid.isPending}
                              title="Mark as Paid"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => { setEditInv({ ...inv }); setEditOpen(true); }}
                            title="Edit"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => generatePDF(inv)}
                            title="Print"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 h-8 px-2"
                            onClick={() => setDeleteId(inv.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Invoice Preview Dialog (Clean White Design) ── */}
      <Dialog open={!!previewInv} onOpenChange={(o) => { if (!o) setPreviewInv(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {previewInv && (
            <InvoicePreview
              invoice={previewInv}
              tenantName={tenantName}
              planName={getPlanName(previewInv.plan_id)}
              onPrint={() => generatePDF(previewInv)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditInv(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Invoice</DialogTitle></DialogHeader>
          {editInv && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={editInv.amount} onChange={(e) => setEditInv({ ...editInv, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tax Amount</Label>
                  <Input type="number" value={editInv.tax_amount || 0} onChange={(e) => setEditInv({ ...editInv, tax_amount: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input type="number" value={editInv.total_amount} onChange={(e) => setEditInv({ ...editInv, total_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select value={editInv.billing_cycle || "monthly"} onValueChange={(v) => setEditInv({ ...editInv, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={editInv.due_date || ""} onChange={(e) => setEditInv({ ...editInv, due_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editInv.status} onValueChange={(v) => setEditInv({ ...editInv, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={editInv.notes || ""} onChange={(e) => setEditInv({ ...editInv, notes: e.target.value })} placeholder="Optional notes" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editInvoice.mutate(editInv)} disabled={editInvoice.isPending}>
              {editInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => deleteId && deleteInvoice.mutate(deleteId)}
        loading={deleteInvoice.isPending}
        title="Delete this invoice?"
        description="This action cannot be undone. The invoice will be permanently removed."
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Clean White Invoice Preview Component
// ═══════════════════════════════════════════════════════════════
function InvoicePreview({
  invoice,
  tenantName,
  planName,
  onPrint,
}: {
  invoice: any;
  tenantName?: string;
  planName: string;
  onPrint: () => void;
}) {
  const { data: branding } = useQuery({
    queryKey: ["resolved-branding"],
    queryFn: () => getResolvedBranding(),
    staleTime: 60_000,
  });

  const b = branding || {
    software_name: "Smart ISP",
    company_name: "Smart ISP",
    address: "",
    support_email: "",
    support_phone: "",
    logo_url: null,
    footer_text: "",
    copyright_text: "",
    email: "",
    mobile: "",
  };

  const statusColor = invoice.status === "paid"
    ? "bg-emerald-500 text-white"
    : invoice.status === "overdue"
    ? "bg-red-500 text-white"
    : "bg-amber-500 text-white";

  return (
    <div className="bg-white text-gray-900" style={{ background: "#ffffff" }}>
      <div className="p-8 md:p-10 max-w-[800px] mx-auto">
        {/* Header: Logo + Status */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            {b.logo_url ? (
              <img src={b.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                {b.company_name?.charAt(0) || "S"}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900">{b.company_name}</h2>
              {b.address && <p className="text-xs text-gray-500">{b.address}</p>}
            </div>
          </div>
          <span className={`px-3 py-1 rounded text-xs font-bold ${statusColor}`}>
            {(invoice.status || "pending").toUpperCase()}
          </span>
        </div>

        {/* Invoice Title */}
        <h1 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-3">
          Invoice #{invoice.id?.substring(0, 8).toUpperCase() || "N/A"}
        </h1>

        {/* Two Column: Invoiced To / Pay To */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Invoiced To</h3>
            <p className="text-sm font-semibold text-gray-900">{tenantName || "Tenant"}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Pay To</h3>
            <p className="text-sm font-semibold text-gray-900">{b.company_name}</p>
            {b.address && <p className="text-xs text-gray-500">{b.address}</p>}
            {(b.support_phone || b.mobile) && (
              <p className="text-xs text-gray-500">{b.support_phone || b.mobile}</p>
            )}
          </div>
        </div>

        {/* Date / Payment Method Row */}
        <div className="grid grid-cols-2 gap-6 mb-6 border-t border-b border-gray-100 py-3">
          <div>
            <span className="text-xs font-bold text-gray-500">Invoice Date</span>
            <p className="text-sm text-gray-800">
              {invoice.created_at ? format(new Date(invoice.created_at), "dd-MM-yyyy") : "-"}
            </p>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500">Payment Method</span>
            <p className="text-sm text-gray-800">{invoice.payment_method || "N/A"}</p>
          </div>
        </div>

        {/* Invoice Items */}
        <h3 className="text-center text-base font-bold text-gray-800 mb-3">Invoice Items</h3>
        <table className="w-full text-sm mb-2">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 font-bold text-gray-600">Description</th>
              <th className="text-center py-2 font-bold text-gray-600">Quantity</th>
              <th className="text-right py-2 font-bold text-gray-600">Rate</th>
              <th className="text-right py-2 font-bold text-gray-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2 text-gray-800">{planName} Subscription</td>
              <td className="py-2 text-center text-gray-600">
                1 {(invoice.billing_cycle || "monthly") === "yearly" ? "Year" : "Month"}
              </td>
              <td className="py-2 text-right text-gray-600">
                {Number(invoice.amount || 0).toFixed(2)} TK
              </td>
              <td className="py-2 text-right font-semibold text-gray-800">
                {Number(invoice.amount || 0).toFixed(2)} TK
              </td>
            </tr>
            {Number(invoice.tax_amount || 0) > 0 && (
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-800">Tax</td>
                <td className="py-2 text-center text-gray-600">-</td>
                <td className="py-2 text-right text-gray-600">-</td>
                <td className="py-2 text-right text-gray-800">
                  {Number(invoice.tax_amount).toFixed(2)} TK
                </td>
              </tr>
            )}
            {Number(invoice.proration_credit || 0) > 0 && (
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-800">Proration Credit</td>
                <td className="py-2 text-center text-gray-600">-</td>
                <td className="py-2 text-right text-gray-600">-</td>
                <td className="py-2 text-right text-emerald-600">
                  -{Number(invoice.proration_credit).toFixed(2)} TK
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <td colSpan={3} className="py-2 text-right font-bold text-gray-700">Total</td>
              <td className="py-2 text-right font-bold text-gray-900">
                {Number(invoice.total_amount || 0).toFixed(2)} TK
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Transaction Details (if paid) */}
        {invoice.status === "paid" && (invoice.transaction_id || invoice.paid_date) && (
          <div className="mt-4 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 font-bold text-gray-600">Transaction Date</th>
                  <th className="text-center py-2 font-bold text-gray-600">Gateway</th>
                  <th className="text-center py-2 font-bold text-gray-600">Transaction ID</th>
                  <th className="text-right py-2 font-bold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-800">
                    {invoice.paid_date ? format(new Date(invoice.paid_date), "dd-MM-yyyy") : "-"}
                  </td>
                  <td className="py-2 text-center text-gray-600">
                    {invoice.payment_method || "Manual"}
                  </td>
                  <td className="py-2 text-center text-gray-600">
                    {invoice.transaction_id || "-"}
                  </td>
                  <td className="py-2 text-right font-semibold text-gray-800">
                    {Number(invoice.total_amount || 0).toFixed(2)} TK
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <p className="text-xs text-gray-400 italic mt-2 mb-4">Notes: {invoice.notes}</p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-gray-100">
          <Button size="sm" onClick={onPrint} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-4 w-4" /> Download
          </Button>
        </div>

        {/* Footer Branding */}
        {(b.footer_text || b.copyright_text) && (
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            {b.footer_text && <p className="text-xs text-gray-400">{b.footer_text}</p>}
            {b.copyright_text && <p className="text-xs text-gray-400 mt-1">{b.copyright_text}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Clean White PDF Generator with Full Branding
// ═══════════════════════════════════════════════════════════════
function generateCleanInvoicePDF(invoice: any, branding: BrandingData, tenantName?: string) {
  const doc = new jsPDF("p", "mm", "a4");
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;

  // White background (default)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, ph, "F");

  let y = 20;

  // ── Company Header (Logo left, Status right) ──
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text(branding.company_name, m, y);

  if (branding.address) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(branding.address, m, y + 5);
  }

  // Status badge (top-right)
  const statusText = (invoice.status || "pending").toUpperCase();
  if (invoice.status === "paid") {
    doc.setFillColor(16, 150, 72);
  } else if (invoice.status === "overdue") {
    doc.setFillColor(210, 50, 50);
  } else {
    doc.setFillColor(200, 150, 30);
  }
  const badgeW = doc.getTextWidth(statusText) * 0.35 + 10;
  doc.roundedRect(pw - m - badgeW, y - 4, badgeW, 7, 1.5, 1.5, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, pw - m - badgeW / 2, y, { align: "center" });

  y += 14;

  // ── Invoice Title ──
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(m, y, pw - m, y);
  y += 8;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text(`Invoice #${(invoice.id || "").substring(0, 8).toUpperCase()}`, m, y);
  y += 10;

  // ── Two Column: Invoiced To / Pay To ──
  const colMid = pw / 2;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("Invoiced To", m, y);
  doc.text("Pay To", colMid + 5, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text(tenantName || "Tenant", m, y);
  doc.text(branding.company_name, colMid + 5, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);

  let leftY = y;
  let rightY = y;

  if (branding.address) {
    doc.text(branding.address, colMid + 5, rightY);
    rightY += 4;
  }
  if (branding.support_phone || branding.mobile) {
    doc.text(branding.support_phone || branding.mobile, colMid + 5, rightY);
    rightY += 4;
  }
  if (branding.support_email || branding.email) {
    doc.text(branding.support_email || branding.email, colMid + 5, rightY);
    rightY += 4;
  }

  y = Math.max(leftY, rightY) + 4;

  // ── Date / Payment Method ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("Invoice Date", m, y);
  doc.text("Payment Method", colMid + 5, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(9);
  doc.text(
    invoice.created_at ? format(new Date(invoice.created_at), "dd-MM-yyyy") : "-",
    m, y
  );
  doc.text(invoice.payment_method || "N/A", colMid + 5, y);
  y += 10;

  // ── Invoice Items Table ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text("Invoice Items", pw / 2, y, { align: "center" });
  y += 7;

  // Table header
  const cols = [m, m + 70, m + 110, pw - m];
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(m, y, pw - m, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("Description", cols[0], y);
  doc.text("Quantity", cols[1], y);
  doc.text("Rate", cols[2], y);
  doc.text("Amount", cols[3] - 2, y, { align: "right" });
  y += 3;
  doc.line(m, y, pw - m, y);
  y += 5;

  // Data row
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  const cycle = (invoice.billing_cycle || "monthly") === "yearly" ? "1 Year" : "1 Month";
  doc.text("Subscription Fee", cols[0], y);
  doc.text(cycle, cols[1], y);
  doc.text(`${Number(invoice.amount || 0).toFixed(2)} TK`, cols[2], y);
  doc.text(`${Number(invoice.amount || 0).toFixed(2)} TK`, cols[3] - 2, y, { align: "right" });
  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(m, y, pw - m, y);
  y += 5;

  if (Number(invoice.tax_amount || 0) > 0) {
    doc.text("Tax", cols[0], y);
    doc.text("-", cols[1], y);
    doc.text("-", cols[2], y);
    doc.text(`${Number(invoice.tax_amount).toFixed(2)} TK`, cols[3] - 2, y, { align: "right" });
    y += 4;
    doc.line(m, y, pw - m, y);
    y += 5;
  }

  if (Number(invoice.proration_credit || 0) > 0) {
    doc.setTextColor(16, 150, 72);
    doc.text("Proration Credit", cols[0], y);
    doc.text("-", cols[1], y);
    doc.text("-", cols[2], y);
    doc.text(`-${Number(invoice.proration_credit).toFixed(2)} TK`, cols[3] - 2, y, { align: "right" });
    y += 4;
    doc.setTextColor(50, 50, 50);
    doc.line(m, y, pw - m, y);
    y += 5;
  }

  // Total row
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.line(cols[2] - 10, y - 2, pw - m, y - 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(10);
  doc.text("Total", cols[2], y + 2);
  doc.text(`${Number(invoice.total_amount || 0).toFixed(2)} TK`, cols[3] - 2, y + 2, { align: "right" });
  y += 10;

  // ── Transaction Details (if paid) ──
  if (invoice.status === "paid" && (invoice.transaction_id || invoice.paid_date)) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(m, y, pw - m, y);
    y += 6;

    const txCols = [m, m + 45, m + 90, pw - m];
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text("Transaction Date", txCols[0], y);
    doc.text("Gateway", txCols[1], y);
    doc.text("Transaction ID", txCols[2], y);
    doc.text("Amount", txCols[3] - 2, y, { align: "right" });
    y += 3;
    doc.line(m, y, pw - m, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.text(invoice.paid_date ? format(new Date(invoice.paid_date), "dd-MM-yyyy") : "-", txCols[0], y);
    doc.text(invoice.payment_method || "Manual", txCols[1], y);
    doc.text(invoice.transaction_id || "-", txCols[2], y);
    doc.text(`${Number(invoice.total_amount || 0).toFixed(2)} TK`, txCols[3] - 2, y, { align: "right" });
    y += 8;
  }

  // ── Footer ──
  const footerY = ph - 20;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(m, footerY - 5, pw - m, footerY - 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);

  if (branding.footer_text) {
    doc.text(branding.footer_text, pw / 2, footerY, { align: "center" });
  }

  const contactLine = [
    branding.support_phone || branding.mobile,
    branding.support_email || branding.email,
  ].filter(Boolean).join("  |  ");

  if (contactLine) {
    doc.text(contactLine, pw / 2, footerY + 4, { align: "center" });
  }

  if (branding.copyright_text) {
    doc.text(branding.copyright_text, pw / 2, footerY + 8, { align: "center" });
  }

  doc.save(`invoice-${(invoice.id || "").substring(0, 8)}-${format(new Date(invoice.created_at || new Date()), "yyyyMMdd")}.pdf`);
}
