import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════════
// Shared PDF Design System — Consistent across ALL reports
// ═══════════════════════════════════════════════════════════════

// ─── Color Palette ───
export const PDF_COLORS = {
  navy: [22, 50, 110] as [number, number, number],
  navyLight: [30, 64, 130] as [number, number, number],
  text: [35, 35, 35] as [number, number, number],
  textMuted: [110, 110, 110] as [number, number, number],
  textLight: [160, 160, 160] as [number, number, number],
  border: [210, 215, 220] as [number, number, number],
  bgLight: [245, 247, 250] as [number, number, number],
  bgRow: [250, 251, 253] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [16, 150, 72] as [number, number, number],
  danger: [210, 50, 50] as [number, number, number],
  accent: [37, 99, 235] as [number, number, number],
};

// ─── Font Sizes ───
export const PDF_FONT = {
  title: 15,
  subtitle: 11,
  heading: 10,
  body: 9,
  small: 8,
  tiny: 7,
  micro: 6.5,
};

// ─── Spacing ───
export const PDF_SPACING = {
  margin: 16,
  sectionGap: 10,
  rowHeight: 7,
  headerHeight: 8,
  lineGap: 5.5,
};

// ─── Company Settings Cache ───
export async function getCompanySettings() {
  try {
    const { data } = await supabase.from("general_settings").select("*").limit(1).maybeSingle();
    return data;
  } catch { return null; }
}

export async function getInvoiceSettings(): Promise<Record<string, string>> {
  try {
    const { data } = await (supabase as any)
      .from("system_settings")
      .select("setting_key, setting_value")
      .like("setting_key", "invoice_%");
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value || ""; });
    return map;
  } catch { return {}; }
}

// ─── Draw Page Header with company branding ───
export function drawCompanyHeader(
  doc: jsPDF,
  opts: {
    companyName: string;
    subtitle?: string;
    docTitle: string;
    docMeta?: string[];
    style?: "banner" | "clean";
  }
) {
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;
  const style = opts.style || "clean";

  if (style === "banner") {
    // Full-width navy banner
    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(0, 0, pw, 36, "F");

    doc.setTextColor(...PDF_COLORS.white);
    doc.setFontSize(PDF_FONT.title);
    doc.setFont("helvetica", "bold");
    doc.text(opts.companyName, m, 14);

    if (opts.subtitle) {
      doc.setFontSize(PDF_FONT.small);
      doc.setFont("helvetica", "normal");
      doc.text(opts.subtitle, m, 21);
    }

    doc.setFontSize(PDF_FONT.heading);
    doc.setFont("helvetica", "bold");
    doc.text(opts.docTitle, pw - m, 14, { align: "right" });

    if (opts.docMeta?.length) {
      doc.setFontSize(PDF_FONT.small);
      doc.setFont("helvetica", "normal");
      opts.docMeta.forEach((line, i) => {
        doc.text(line, pw - m, 21 + i * 5, { align: "right" });
      });
    }

    return 42;
  }

  // Clean style — company name right, doc title centered
  doc.setFontSize(PDF_FONT.title);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(opts.companyName, pw - m, 18, { align: "right" });

  if (opts.subtitle) {
    doc.setFontSize(PDF_FONT.tiny);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(opts.subtitle, pw - m, 24, { align: "right" });
  }

  let y = 32;
  doc.setDrawColor(...PDF_COLORS.text);
  doc.setLineWidth(0.4);
  doc.line(m, y, pw - m, y);
  y += 6;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(opts.docTitle, pw / 2, y, { align: "center" });
  y += 4;
  doc.line(m, y, pw - m, y);

  return y + 8;
}

// ─── Section Header (navy bar) ───
export function drawSectionHeader(doc: jsPDF, title: string, y: number, width?: number) {
  const m = PDF_SPACING.margin;
  const w = width || doc.internal.pageSize.getWidth() - m * 2;
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(m, y, w, 7, "F");
  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(title.toUpperCase(), m + 4, y + 5);
  doc.setTextColor(...PDF_COLORS.text);
  return y + 10;
}

// ─── Table Header Row ───
export function drawTableHeader(
  doc: jsPDF,
  columns: { label: string; x: number; w: number; align?: "left" | "center" | "right" }[],
  y: number
) {
  const m = PDF_SPACING.margin;
  const pw = doc.internal.pageSize.getWidth();
  const totalW = pw - m * 2;
  const h = PDF_SPACING.headerHeight;

  doc.setFillColor(...PDF_COLORS.bgLight);
  doc.rect(m, y, totalW, h, "F");
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.25);
  doc.line(m, y, m + totalW, y);
  doc.line(m, y + h, m + totalW, y + h);

  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);

  columns.forEach((col) => {
    const align = col.align || "center";
    const tx = align === "center" ? col.x + col.w / 2 : align === "right" ? col.x + col.w - 2 : col.x + 2;
    doc.text(col.label, tx, y + h / 2 + 1, { align });
  });

  return y + h;
}

// ─── Key-Value Info Row ───
export function drawInfoRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth = 32
) {
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(`${label}:`, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(value || "—", x + labelWidth, y);
}

// ─── Footer ───
export function drawFooter(
  doc: jsPDF,
  opts: {
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    noteText?: string;
    techSupport?: string;
  }
) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = PDF_SPACING.margin;
  const contentW = pw - m * 2;

  let footerY = ph - 28;

  // Note text
  if (opts.noteText) {
    doc.setFontSize(PDF_FONT.tiny);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(opts.noteText, pw / 2, footerY, { align: "center", maxWidth: contentW });
    footerY += 6;
  }

  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(m, footerY, pw - m, footerY);
  footerY += 5;

  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.textMuted);

  if (opts.companyAddress) {
    doc.text(opts.companyAddress, pw / 2, footerY, { align: "center", maxWidth: contentW });
    footerY += 4;
  }

  const contactParts: string[] = [];
  if (opts.companyPhone) contactParts.push(`Phone: ${opts.companyPhone}`);
  if (opts.companyEmail) contactParts.push(`Email: ${opts.companyEmail}`);
  if (opts.techSupport) contactParts.push(`Support: ${opts.techSupport}`);
  if (contactParts.length) {
    doc.text(contactParts.join("  |  "), pw / 2, footerY, { align: "center" });
  }
}

// ─── Format currency ───
export function fmtCurrency(val: number, symbol = "Tk "): string {
  return `${symbol}${Math.abs(val).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtAmount(val: number): string {
  return Math.abs(val).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Number to words (BDT) ───
export function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  };

  return convert(Math.floor(Math.abs(num)));
}

// ─── Payment methods from invoice settings ───
export function getPaymentMethodLines(invoiceSettings: Record<string, string>): string[] {
  const lines: string[] = [];
  const chequeText = invoiceSettings.invoice_cheque_text;
  if (chequeText) lines.push(chequeText);
  try {
    const banks: { bank_name: string; account_no: string }[] = JSON.parse(invoiceSettings.invoice_bank_accounts || "[]");
    banks.filter(b => b.bank_name).forEach(b => lines.push(`${b.bank_name}: ${b.account_no}`));
  } catch {}
  if (invoiceSettings.invoice_bkash_merchant) lines.push(`bKash Merchant: ${invoiceSettings.invoice_bkash_merchant}`);
  if (invoiceSettings.invoice_nagad_merchant) lines.push(`Nagad Merchant: ${invoiceSettings.invoice_nagad_merchant}`);
  if (invoiceSettings.invoice_rocket_biller_id) lines.push(`Rocket Biller ID: ${invoiceSettings.invoice_rocket_biller_id}`);
  if (invoiceSettings.invoice_visa_card_info) lines.push(invoiceSettings.invoice_visa_card_info);
  return lines;
}
