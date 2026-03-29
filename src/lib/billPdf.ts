import jsPDF from "jspdf";
import { format } from "date-fns";
import {
  PDF_COLORS, PDF_FONT, PDF_SPACING,
  getCompanySettings, getInvoiceSettings,
  drawFooter, getPaymentMethodLines, fmtAmount,
} from "./pdfTheme";
import { supabase } from "@/integrations/supabase/client";

async function getPreviousBalance(customerId: string, billMonth: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("customer_ledger" as any)
      .select("balance")
      .eq("customer_id", customerId)
      .lt("date", billMonth + "-01")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return Number((data as any)?.balance || 0);
  } catch { return 0; }
}

export async function generateBillInvoicePDF(bill: any, customer: any) {
  const [settings, invoiceSettings] = await Promise.all([getCompanySettings(), getInvoiceSettings()]);
  const companyName = settings?.site_name || "Smart ISP";
  const companyAddress = settings?.address || "";
  const companyPhone = settings?.mobile || settings?.support_phone || "";
  const companyEmail = settings?.email || settings?.support_email || "";
  const previousBalance = await getPreviousBalance(customer?.id || bill.customer_id, bill.month);

  const vatReg = invoiceSettings.invoice_vat_reg || "";
  const techSupport = invoiceSettings.invoice_tech_support || settings?.support_phone || companyPhone || "";

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;
  const mR = pw - m;
  const contentW = mR - m;

  // ──── Company name top-right ────
  doc.setFontSize(PDF_FONT.title);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(companyName, mR, 18, { align: "right" });
  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text("Internet Service Provider", mR, 24, { align: "right" });

  // ──── INVOICE title ────
  let y = 32;
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(0.5);
  doc.line(m, y, mR, y);
  y += 7;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("INVOICE", pw / 2, y, { align: "center" });
  y += 5;
  doc.line(m, y, mR, y);
  y += 10;

  // ──── Client Info (left) + Billing Statement (right) ────
  const infoStartY = y;

  // Left section
  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("Client's Information", m, y);
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(0.3);
  doc.line(m, y + 1.5, m + doc.getTextWidth("Client's Information"), y + 1.5);
  y += 8;

  const infoRow = (label: string, value: string) => {
    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(`${label}:`, m, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", m + doc.getTextWidth(`${label}: `) + 1, y);
    y += 6;
  };

  infoRow("Client ID", customer?.customer_id || "—");
  infoRow("Client Name", customer?.name || "—");

  const addressParts = [customer?.house, customer?.road, customer?.area, customer?.village, customer?.city, customer?.district].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : customer?.area || "—";
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("Address:", m, y);
  const addrLabelW = doc.getTextWidth("Address: ") + 1;
  doc.setFont("helvetica", "normal");
  const addrLines = doc.splitTextToSize(fullAddress, pw / 2 - addrLabelW - 5);
  doc.text(addrLines, m + addrLabelW, y);
  y += 6 * Math.max(addrLines.length, 1);

  infoRow("Mobile No", customer?.phone || "—");
  if (customer?.email) infoRow("Email", customer.email);

  // Right section
  let ry = infoStartY;
  const rightX = pw / 2 + 14;
  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("Billing Statement", rightX, ry);
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.line(rightX, ry + 1.5, rightX + doc.getTextWidth("Billing Statement"), ry + 1.5);
  ry += 8;

  const billingRow = (label: string, value: string) => {
    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(`${label}:`, rightX, ry);
    doc.setFont("helvetica", "normal");
    doc.text(value, rightX + 36, ry);
    ry += 6;
  };

  billingRow("Invoice No", `INV#${bill.id?.substring(0, 10).toUpperCase() || "0000000000"}`);
  billingRow("Invoice Date", bill.created_at ? format(new Date(bill.created_at), "do MMM, yyyy") : format(new Date(), "do MMM, yyyy"));
  billingRow("Due Date", bill.due_date ? format(new Date(bill.due_date), "do MMM, yyyy") : "—");

  // ──── Items Table ────
  y = Math.max(y, ry) + 12;

  const cols = [
    { label: "SL", x: m, w: 12 },
    { label: "Link ID", x: m + 12, w: 24 },
    { label: "Bill Type", x: m + 36, w: 28 },
    { label: "Package", x: m + 64, w: 40 },
    { label: "Amount", x: m + 104, w: 22 },
    { label: "Duration", x: m + 126, w: 34 },
    { label: "Total", x: m + 160, w: contentW - 160 },
  ];

  // Header
  doc.setFillColor(...PDF_COLORS.bgLight);
  doc.rect(m, y - 5, contentW, 8, "F");
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.25);
  doc.line(m, y - 5, mR, y - 5);
  doc.line(m, y + 3, mR, y + 3);

  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  cols.forEach((col) => doc.text(col.label, col.x + col.w / 2, y, { align: "center" }));
  y += 8;

  // Data row
  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.text);

  doc.text("1", cols[0].x + cols[0].w / 2, y, { align: "center" });
  doc.text(customer?.customer_id || "—", cols[1].x + cols[1].w / 2, y, { align: "center" });
  doc.text("Monthly Bill", cols[2].x + cols[2].w / 2, y, { align: "center" });
  doc.text(customer?.packages?.name || customer?.package_name || "—", cols[3].x + cols[3].w / 2, y, { align: "center" });
  doc.text(String(Number(bill.amount).toLocaleString()), cols[4].x + cols[4].w / 2, y, { align: "center" });

  let billDuration = "—";
  if (bill.month) {
    try {
      const [yr, mn] = bill.month.split("-").map(Number);
      const start = new Date(yr, mn - 1, 1);
      const end = new Date(yr, mn, 0);
      billDuration = `${format(start, "dd-MMM-yy")} To ${format(end, "dd-MMM-yy")}`;
    } catch { billDuration = bill.month; }
  }
  const durLines = doc.splitTextToSize(billDuration, cols[5].w - 2);
  doc.text(durLines, cols[5].x + cols[5].w / 2, y - 1, { align: "center" });
  doc.text(Number(bill.amount).toFixed(2), cols[6].x + cols[6].w / 2, y, { align: "center" });

  y += 10;
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m, y, mR, y);
  y += 6;

  // ──── Summary ────
  const summaryLabelX = m + 100;
  const summaryValueX = mR;
  const totalAmount = Number(bill.amount);

  const summaryRow = (label: string, value: string, bold = false) => {
    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(label, summaryValueX - 22, y, { align: "right" });
    doc.text(value, summaryValueX, y, { align: "right" });
    doc.setDrawColor(...PDF_COLORS.border);
    doc.line(summaryLabelX, y + 2.5, mR, y + 2.5);
    y += 7;
  };

  summaryRow("Including VAT Total:", totalAmount.toFixed(2));
  summaryRow("Previous Balance:", previousBalance.toFixed(2));
  const totalPayable = totalAmount + previousBalance;

  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("Total Payable:", summaryValueX - 22, y, { align: "right" });
  doc.text(totalPayable.toFixed(2), summaryValueX, y, { align: "right" });
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(0.4);
  doc.line(summaryLabelX, y + 3, mR, y + 3);
  y += 12;

  // ──── Payment Info ────
  doc.setFontSize(PDF_FONT.small);
  doc.setTextColor(...PDF_COLORS.textMuted);
  if (vatReg) { doc.text(`VAT Reg: ${vatReg}`, m, y); y += 5; }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("Available Payment Methods:", m, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONT.small);
  doc.setTextColor(...PDF_COLORS.textMuted);

  getPaymentMethodLines(invoiceSettings).forEach((line) => { doc.text(line, m, y); y += 4.5; });

  if (techSupport) { y += 2; doc.text(`24/7 Technical Support: ${techSupport}`, m, y); }

  // ──── Footer ────
  drawFooter(doc, {
    companyAddress, companyPhone, companyEmail, techSupport,
    noteText: `NB: This invoice is system-generated and valid without signature. For queries: ${techSupport || companyPhone || "support"}`,
  });

  doc.save(`Invoice-${bill.month}-${customer?.customer_id || bill.id?.substring(0, 8)}.pdf`);
}
