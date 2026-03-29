import jsPDF from "jspdf";
import {
  PDF_COLORS, PDF_FONT, PDF_SPACING,
  getCompanySettings, getInvoiceSettings,
  drawFooter, getPaymentMethodLines,
} from "./pdfTheme";
import { supabase } from "@/integrations/supabase/client";

// ─── Payment Receipt ───
export async function generatePaymentReceiptPDF(payment: any, customer: any, invoiceFooter?: string) {
  const [settings, invoiceSettings] = await Promise.all([getCompanySettings(), getInvoiceSettings()]);
  const companyName = settings?.site_name || "Smart ISP";
  const companyAddress = settings?.address || "";
  const companyPhone = settings?.mobile || settings?.support_phone || "";
  const companyEmail = settings?.email || settings?.support_email || "";
  const techSupport = invoiceSettings.invoice_tech_support || settings?.support_phone || companyPhone || "";

  const receiptNo = `PMT#${(payment.id || "00000000").substring(0, 10).toUpperCase()}`;
  const paymentDate = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;
  const mR = pw - m;
  const contentW = mR - m;

  // ──── Company Header ────
  doc.setFontSize(PDF_FONT.title);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(companyName, mR, 18, { align: "right" });
  if (companyAddress) {
    doc.setFontSize(PDF_FONT.small);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(companyAddress, mR, 24, { align: "right" });
  }

  // ──── Title ────
  let y = 34;
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(0.5);
  doc.line(m, y, mR, y);
  y += 7;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("PAYMENT RECEIPT", pw / 2, y, { align: "center" });
  y += 5;
  doc.line(m, y, mR, y);
  y += 12;

  // ──── Client Info (left) + Payment Statement (right) ────
  const leftX = m;
  const rightX = pw / 2 + 14;
  const infoY = y;

  // Left
  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("Client's Information", leftX, y);
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(0.25);
  doc.line(leftX, y + 1.5, leftX + doc.getTextWidth("Client's Information"), y + 1.5);
  y += 8;

  const clientFields = [
    ["Client ID", customer?.customer_id || "—"],
    ["Client Name", customer?.name || "—"],
    ["Address", [customer?.house ? `House# ${customer.house}` : "", customer?.road ? `Road# ${customer.road}` : "", customer?.area || ""].filter(Boolean).join(", ") || "—"],
    ["Mobile No", customer?.phone || "—"],
  ];

  doc.setFontSize(PDF_FONT.body);
  clientFields.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(`${label}:`, leftX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value as string, leftX + 30, y);
    y += 6.5;
  });

  // Right
  let ry = infoY;
  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("Payment Statement", rightX, ry);
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.line(rightX, ry + 1.5, rightX + doc.getTextWidth("Payment Statement"), ry + 1.5);
  ry += 8;

  const payFields = [
    ["Receipt No", receiptNo],
    ["Payment Date", paymentDate],
  ];

  doc.setFontSize(PDF_FONT.body);
  payFields.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(`${label}:`, rightX, ry);
    doc.setFont("helvetica", "normal");
    doc.text(value, rightX + 30, ry);
    ry += 6.5;
  });

  y = Math.max(y, ry) + 12;

  // ──── Payment Details Table ────
  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("Payment Details", m, y);
  y += 8;

  const colW1 = contentW / 2;
  const rowH = 9;

  const drawRow = (label: string, value: string, isHeader = false) => {
    if (isHeader) {
      doc.setFillColor(...PDF_COLORS.bgLight);
      doc.rect(m, y, colW1, rowH, "F");
      doc.rect(m + colW1, y, colW1, rowH, "F");
    }
    doc.setDrawColor(...PDF_COLORS.border);
    doc.rect(m, y, colW1, rowH, "S");
    doc.rect(m + colW1, y, colW1, rowH, "S");

    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", isHeader ? "bold" : "normal");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(label, m + 4, y + 6);
    doc.text(value, m + colW1 + 4, y + 6);
    y += rowH;
  };

  const fmtMethod = (m: string) => {
    const map: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank Transfer" };
    return map[m?.toLowerCase()] || m || "—";
  };

  drawRow("Payment Mode", "Prepaid");
  drawRow("Payment Method", fmtMethod(payment.payment_method));
  drawRow("Paid Amount", `${Number(payment.amount).toFixed(2)} BDT`);
  drawRow("Transaction ID", payment.transaction_id || payment.bkash_trx_id || "—");

  y += 12;

  // ──── Payment Methods ────
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("Available Payment Methods:", m, y);
  y += 6;

  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.textMuted);
  getPaymentMethodLines(invoiceSettings).forEach((line) => { doc.text(line, m, y); y += 4.5; });

  if (techSupport) { y += 2; doc.text(`24/7 Technical Support: ${techSupport}`, m, y); }

  // ──── Footer ────
  drawFooter(doc, {
    companyAddress, companyPhone, companyEmail,
    noteText: invoiceFooter || invoiceSettings.invoice_footer || "NB: This receipt is system-generated and valid without signature.",
  });

  doc.save(`receipt-${receiptNo}.pdf`);
}

// ─── Customer Application Form PDF ───
export function generateCustomerPDF(customer: any, invoiceFooter?: string) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = 14;
  const contentW = pw - m * 2;
  let y = 0;

  // ─── HEADER ───
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pw, 36, "F");

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Smart ISP", m, 14);
  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "normal");
  doc.text("Internet Service Provider", m, 20);

  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.text("APPLICATION FORM", pw - m, 14, { align: "right" });
  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "normal");
  doc.text(`Form No: ${customer.customer_id || "—"}`, pw - m, 22, { align: "right" });
  doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, pw - m, 28, { align: "right" });

  y = 42;

  // ─── HELPERS ───
  const sectionHeader = (title: string) => {
    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(m, y, contentW, 7, "F");
    doc.setFontSize(PDF_FONT.small);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.white);
    doc.text(title.toUpperCase(), m + 4, y + 5);
    y += 10;
    doc.setTextColor(...PDF_COLORS.text);
  };

  const fieldBox = (label: string, value: string, x: number, w: number, h = 10) => {
    doc.setDrawColor(...PDF_COLORS.border);
    doc.rect(x, y, w, h, "S");
    doc.setFillColor(...PDF_COLORS.bgLight);
    doc.rect(x, y, w, 4, "F");
    doc.setFontSize(PDF_FONT.micro);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(label, x + 2, y + 3);
    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(value || "—", x + 2, y + 8);
  };

  const fieldRow = (fields: { label: string; value: string }[], h = 10) => {
    const fw = contentW / fields.length;
    fields.forEach((f, i) => fieldBox(f.label, f.value, m + fw * i, fw, h));
    y += h + 1;
  };

  // ─── SECTIONS ───
  sectionHeader("Customer Information");
  fieldRow([{ label: "Applicant Name", value: customer.name || "" }, { label: "Father Name", value: customer.father_name || "" }]);
  fieldRow([{ label: "Customer ID", value: customer.customer_id || "" }, { label: "National ID", value: customer.nid || "" }, { label: "Email", value: customer.email || "" }]);
  fieldRow([{ label: "Mobile Number", value: customer.phone || "" }, { label: "Alt Contact", value: customer.alt_phone || "" }, { label: "Occupation", value: customer.occupation || "" }, { label: "Mother Name", value: customer.mother_name || "" }]);
  y += 3;

  sectionHeader("Address Information");
  fieldRow([{ label: "Zone / Area", value: customer.area || "" }, { label: "Road No", value: customer.road || "" }, { label: "House No", value: customer.house || "" }, { label: "City", value: customer.city || "" }]);
  fieldBox("Permanent Address", customer.permanent_address || "", m, contentW, 12);
  y += 13;
  y += 3;

  sectionHeader("Connection Details");
  fieldRow([{ label: "Package Name", value: customer.packages?.name || "" }, { label: "Speed", value: customer.packages?.speed || "" }]);
  fieldRow([{ label: "PPPoE Username", value: customer.pppoe_username || "" }, { label: "PPPoE Password", value: customer.pppoe_password || "" }]);
  fieldRow([{ label: "IP Address", value: customer.ip_address || "" }, { label: "Gateway", value: customer.gateway || "" }, { label: "Subnet", value: customer.subnet || "" }]);
  fieldRow([{ label: "ONU MAC", value: customer.onu_mac || "" }, { label: "Router MAC", value: customer.router_mac || "" }]);
  y += 3;

  sectionHeader("Billing Information");
  const monthlyBill = Number(customer.monthly_bill || 0);
  const discount = Number(customer.discount || 0);
  fieldRow([
    { label: "Connection Date", value: customer.installation_date || "" },
    { label: "Monthly Bill", value: `${monthlyBill.toLocaleString()} BDT` },
    { label: "Due Date (Day)", value: customer.due_date_day ? `${customer.due_date_day}th` : "—" },
  ]);
  fieldRow([{ label: "Discount", value: `${discount.toLocaleString()} BDT` }, { label: "Total Amount", value: `${(monthlyBill - discount).toLocaleString()} BDT` }]);
  y += 3;

  sectionHeader("Office Use Only");
  fieldRow([{ label: "POP Location", value: customer.pop_location || "" }, { label: "Installed By", value: customer.installed_by || "" }, { label: "Box Name", value: customer.box_name || "" }, { label: "Cable Length", value: customer.cable_length || "" }]);

  if (y > 240) { doc.addPage(); y = 20; }
  y += 8;

  // ─── Signatures ───
  const sigW = (contentW - 10) / 3;
  doc.setDrawColor(...PDF_COLORS.border);
  [
    { label: "Applicant Signature", x: m },
    { label: "Admin Signature", x: m + sigW + 5 },
    { label: "Marketing Signature", x: m + (sigW + 5) * 2 },
  ].forEach(({ label, x }) => {
    doc.line(x, y + 15, x + sigW, y + 15);
    doc.setFontSize(PDF_FONT.small);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(label, x + sigW / 2, y + 20, { align: "center" });
  });

  y += 28;
  doc.setFontSize(PDF_FONT.tiny);
  doc.setTextColor(...PDF_COLORS.textLight);
  doc.text(invoiceFooter || "I hereby declare that all information provided above is correct.", m, y);
  doc.text(`Generated on ${new Date().toLocaleDateString()} — Smart ISP Billing System`, pw / 2, 288, { align: "center" });

  doc.save(`${customer.customer_id || "customer"}-application-form.pdf`);
}
