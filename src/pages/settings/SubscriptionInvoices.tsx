import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Printer, Receipt, Calendar, CreditCard, AlertTriangle, Eye, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { getResolvedBranding, type BrandingData } from "@/lib/brandingHelper";

export default function SubscriptionInvoices() {
  const [previewInv, setPreviewInv] = useState<any>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["my-subscription-invoices"],
    queryFn: async () => {
      const { data } = await (db.from as any)("subscription_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: currentPlan } = useQuery({
    queryKey: ["my-saas-plan"],
    queryFn: async () => {
      const { data: subs } = await (db.from as any)("subscriptions")
        .select("*, plan:saas_plans(*)")
        .limit(1)
        .order("created_at", { ascending: false });
      return subs?.[0] || null;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["saas-plans-lookup"],
    queryFn: async () => {
      const { data } = await (db.from as any)("saas_plans").select("id, name, price, billing_cycle");
      return data || [];
    },
  });

  const { data: branding } = useQuery({
    queryKey: ["resolved-branding-tenant"],
    queryFn: () => getResolvedBranding(),
    staleTime: 60_000,
  });

  const getPlanName = (planId: string) => plans.find((p: any) => p.id === planId)?.name || "N/A";

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      cancelled: "bg-muted text-muted-foreground",
    };
    return <Badge className={variants[status] || "bg-muted text-muted-foreground"}>{status.toUpperCase()}</Badge>;
  };

  const generateInvoicePDF = async (invoice: any) => {
    try {
      const b = branding || await getResolvedBranding();
      generateCleanPDF(invoice, b, getPlanName(invoice.plan_id));
      toast.success("Invoice downloaded");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + (err.message || "Unknown error"));
    }
  };

  const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
  const pendingCount = invoices.filter((i: any) => i.status === "pending" || i.status === "overdue").length;
  const pendingAmount = invoices.filter((i: any) => i.status === "pending" || i.status === "overdue").reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);

  const b = branding || {
    software_name: "Smart ISP", company_name: "Smart ISP", address: "", support_email: "", support_phone: "",
    logo_url: null, footer_text: "", copyright_text: "", email: "", mobile: "",
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Subscription Invoices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">View and download your SaaS subscription invoices</p>
        </div>
        {currentPlan?.plan && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            Current Plan: {currentPlan.plan.name}
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" /> Total Paid
            </div>
            <div className="text-2xl font-bold text-primary mt-1">Tk {totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Pending
            </div>
            <div className="text-2xl font-bold text-destructive mt-1">{pendingCount} invoice(s)</div>
            <div className="text-sm text-muted-foreground">Tk {pendingAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Total Invoices
            </div>
            <div className="text-2xl font-bold mt-1">{invoices.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No subscription invoices found</p>
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
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap">
                        {inv.created_at ? format(new Date(inv.created_at), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-medium">{getPlanName(inv.plan_id)}</TableCell>
                      <TableCell className="capitalize">{inv.billing_cycle || "monthly"}</TableCell>
                      <TableCell className="text-right">Tk {Number(inv.amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">Tk {Number(inv.tax_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">Tk {Number(inv.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setPreviewInv(inv)}
                            title="View Invoice"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateInvoicePDF(inv)}
                            className="gap-1 h-8"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
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
            <div className="bg-white text-gray-900" style={{ background: "#ffffff" }}>
              <div className="p-8 md:p-10 max-w-[800px] mx-auto">
                {/* Header */}
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
                  <span className={`px-3 py-1 rounded text-xs font-bold ${
                    previewInv.status === "paid" ? "bg-emerald-500 text-white"
                    : previewInv.status === "overdue" ? "bg-red-500 text-white"
                    : "bg-amber-500 text-white"
                  }`}>
                    {(previewInv.status || "pending").toUpperCase()}
                  </span>
                </div>

                <h1 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-3">
                  Invoice #{previewInv.id?.substring(0, 8).toUpperCase() || "N/A"}
                </h1>

                {/* Invoiced To / Pay To */}
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Invoiced To</h3>
                    <p className="text-sm font-semibold text-gray-900">Tenant</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Pay To</h3>
                    <p className="text-sm font-semibold text-gray-900">{b.company_name}</p>
                    {b.address && <p className="text-xs text-gray-500">{b.address}</p>}
                    {(b.support_phone || b.mobile) && <p className="text-xs text-gray-500">{b.support_phone || b.mobile}</p>}
                  </div>
                </div>

                {/* Date Row */}
                <div className="grid grid-cols-2 gap-6 mb-6 border-t border-b border-gray-100 py-3">
                  <div>
                    <span className="text-xs font-bold text-gray-500">Invoice Date</span>
                    <p className="text-sm text-gray-800">
                      {previewInv.created_at ? format(new Date(previewInv.created_at), "dd-MM-yyyy") : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-500">Payment Method</span>
                    <p className="text-sm text-gray-800">{previewInv.payment_method || "N/A"}</p>
                  </div>
                </div>

                {/* Items Table */}
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
                      <td className="py-2 text-gray-800">{getPlanName(previewInv.plan_id)} Subscription</td>
                      <td className="py-2 text-center text-gray-600">
                        1 {(previewInv.billing_cycle || "monthly") === "yearly" ? "Year" : "Month"}
                      </td>
                      <td className="py-2 text-right text-gray-600">{Number(previewInv.amount || 0).toFixed(2)} TK</td>
                      <td className="py-2 text-right font-semibold text-gray-800">{Number(previewInv.amount || 0).toFixed(2)} TK</td>
                    </tr>
                    {Number(previewInv.tax_amount || 0) > 0 && (
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-gray-800">Tax</td>
                        <td className="py-2 text-center text-gray-600">-</td>
                        <td className="py-2 text-right text-gray-600">-</td>
                        <td className="py-2 text-right text-gray-800">{Number(previewInv.tax_amount).toFixed(2)} TK</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan={3} className="py-2 text-right font-bold text-gray-700">Total</td>
                      <td className="py-2 text-right font-bold text-gray-900">{Number(previewInv.total_amount || 0).toFixed(2)} TK</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Transaction Details */}
                {previewInv.status === "paid" && (previewInv.transaction_id || previewInv.paid_date) && (
                  <table className="w-full text-sm mt-4">
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
                          {previewInv.paid_date ? format(new Date(previewInv.paid_date), "dd-MM-yyyy") : "-"}
                        </td>
                        <td className="py-2 text-center text-gray-600">{previewInv.payment_method || "Manual"}</td>
                        <td className="py-2 text-center text-gray-600">{previewInv.transaction_id || "-"}</td>
                        <td className="py-2 text-right font-semibold text-gray-800">{Number(previewInv.total_amount || 0).toFixed(2)} TK</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Actions */}
                <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-gray-100">
                  <Button size="sm" onClick={() => generateInvoicePDF(previewInv)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => generateInvoicePDF(previewInv)} className="gap-1.5">
                    <Download className="h-4 w-4" /> Download
                  </Button>
                </div>

                {b.footer_text && (
                  <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400">{b.footer_text}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Clean White PDF Generator (Tenant Side)
// ═══════════════════════════════════════════════════════════════
function generateCleanPDF(invoice: any, branding: BrandingData, planName: string) {
  const doc = new jsPDF("p", "mm", "a4");
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, ph, "F");

  let y = 20;

  // Company header
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

  // Status badge
  const statusText = (invoice.status || "pending").toUpperCase();
  if (invoice.status === "paid") doc.setFillColor(16, 150, 72);
  else if (invoice.status === "overdue") doc.setFillColor(210, 50, 50);
  else doc.setFillColor(200, 150, 30);

  const badgeW = doc.getTextWidth(statusText) * 0.35 + 10;
  doc.roundedRect(pw - m - badgeW, y - 4, badgeW, 7, 1.5, 1.5, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, pw - m - badgeW / 2, y, { align: "center" });

  y += 14;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(m, y, pw - m, y);
  y += 8;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text(`Invoice #${(invoice.id || "").substring(0, 8).toUpperCase()}`, m, y);
  y += 10;

  // Two columns
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
  doc.text("Tenant", m, y);
  doc.text(branding.company_name, colMid + 5, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  let rightY = y;
  if (branding.address) { doc.text(branding.address, colMid + 5, rightY); rightY += 4; }
  if (branding.support_phone || branding.mobile) { doc.text(branding.support_phone || branding.mobile, colMid + 5, rightY); rightY += 4; }

  y = Math.max(y, rightY) + 4;

  // Date row
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("Invoice Date", m, y);
  doc.text("Payment Method", colMid + 5, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(9);
  doc.text(invoice.created_at ? format(new Date(invoice.created_at), "dd-MM-yyyy") : "-", m, y);
  doc.text(invoice.payment_method || "N/A", colMid + 5, y);
  y += 10;

  // Items
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.text("Invoice Items", pw / 2, y, { align: "center" });
  y += 7;

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

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  const cycle = (invoice.billing_cycle || "monthly") === "yearly" ? "1 Year" : "1 Month";
  doc.text(`${planName} Subscription`, cols[0], y);
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

  // Total
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.line(cols[2] - 10, y - 2, pw - m, y - 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(10);
  doc.text("Total", cols[2], y + 2);
  doc.text(`${Number(invoice.total_amount || 0).toFixed(2)} TK`, cols[3] - 2, y + 2, { align: "right" });
  y += 10;

  // Transaction details
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
  }

  // Footer
  const footerY = ph - 20;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(m, footerY - 5, pw - m, footerY - 5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);

  if (branding.footer_text) doc.text(branding.footer_text, pw / 2, footerY, { align: "center" });
  const contactLine = [branding.support_phone || branding.mobile, branding.support_email || branding.email].filter(Boolean).join("  |  ");
  if (contactLine) doc.text(contactLine, pw / 2, footerY + 4, { align: "center" });

  doc.save(`invoice-${(invoice.id || "").substring(0, 8)}-${format(new Date(invoice.created_at || new Date()), "yyyyMMdd")}.pdf`);
}
