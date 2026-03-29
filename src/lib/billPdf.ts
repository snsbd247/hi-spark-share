import jsPDF from "jspdf";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

async function getCompanySettings() {
  try {
    const { data } = await supabase
      .from("general_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

async function getInvoiceSettings(): Promise<Record<string, string>> {
  try {
    const { data } = await (supabase as any)
      .from("system_settings")
      .select("setting_key, setting_value")
      .like("setting_key", "invoice_%");
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value || ""; });
    return map;
  } catch {
    return {};
  }
}

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
  } catch {
    return 0;
  }
}

export async function generateBillInvoicePDF(bill: any, customer: any) {
  const [settings, invoiceSettings] = await Promise.all([
    getCompanySettings(),
    getInvoiceSettings(),
  ]);
  const companyName = settings?.site_name || "Smart ISP";
  const companyAddress = settings?.address || "";
  const companyPhone = settings?.mobile || settings?.support_phone || "";
  const companyEmail = settings?.email || settings?.support_email || "";
  const previousBalance = await getPreviousBalance(customer?.id || bill.customer_id, bill.month);

  // Invoice settings
  const vatReg = invoiceSettings.invoice_vat_reg || "";
  const chequeText = invoiceSettings.invoice_cheque_text || "";
  let bankAccounts: { bank_name: string; account_no: string }[] = [];
  try { bankAccounts = JSON.parse(invoiceSettings.invoice_bank_accounts || "[]"); } catch { bankAccounts = []; }
  const bkashMerchant = invoiceSettings.invoice_bkash_merchant || "";
  const nagadMerchant = invoiceSettings.invoice_nagad_merchant || "";
  const rocketBillerId = invoiceSettings.invoice_rocket_biller_id || "";
  const visaCardInfo = invoiceSettings.invoice_visa_card_info || "";
  const techSupport = invoiceSettings.invoice_tech_support || settings?.support_phone || companyPhone || "";

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const marginL = 18;
  const marginR = pw - 18;
  const contentW = marginR - marginL;

  // ──── Company name top-right ────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(companyName, marginR, 20, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Internet Service Provider", marginR, 26, { align: "right" });

  // ──── INVOICE title centered ────
  let y = 38;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, marginR, y);
  y += 6;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("INVOICE", pw / 2, y, { align: "center" });
  y += 4;
  doc.line(marginL, y, marginR, y);
  y += 8;

  // ──── Client's Information (left) ────
  const infoStartY = y;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Client's Information", marginL, y);
  const tw = doc.getTextWidth("Client's Information");
  doc.setLineWidth(0.3);
  doc.line(marginL, y + 1, marginL + tw, y + 1);
  y += 7;

  const infoRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`${label}:`, marginL, y);
    doc.setFont("helvetica", "normal");
    const labelW = doc.getTextWidth(`${label}: `);
    doc.text(value || "—", marginL + labelW, y);
    y += 5.5;
  };

  infoRow("Client ID", customer?.customer_id || "—");
  infoRow("Client Name", customer?.name || "—");

  const addressParts = [customer?.house, customer?.road, customer?.area, customer?.village, customer?.city, customer?.district].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : customer?.area || "—";

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Address:", marginL, y);
  const addrLabelW = doc.getTextWidth("Address: ");
  doc.setFont("helvetica", "normal");
  const addrLines = doc.splitTextToSize(fullAddress, pw / 2 - addrLabelW - 5);
  doc.text(addrLines, marginL + addrLabelW, y);
  y += 5.5 * Math.max(addrLines.length, 1);

  infoRow("Mobile No", customer?.phone || "—");
  if (customer?.email) infoRow("Email", customer.email);

  // ──── Billing Statement (right) ────
  let ry = infoStartY;
  const rightX = pw / 2 + 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Billing Statement", rightX, ry);
  ry += 7;

  const billingRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`${label}:`, rightX, ry);
    doc.setFont("helvetica", "normal");
    doc.text(value, rightX + 35, ry);
    ry += 5.5;
  };

  const invoiceNo = `INV#${bill.id?.substring(0, 10).toUpperCase() || "0000000000"}`;
  billingRow("Invoice No", invoiceNo);

  const billDate = bill.created_at
    ? format(new Date(bill.created_at), "do MMM, yyyy")
    : format(new Date(), "do MMM, yyyy");
  billingRow("Invoice Date", billDate);

  const dueDate = bill.due_date
    ? format(new Date(bill.due_date), "do MMM, yyyy")
    : "—";
  billingRow("Due Date", dueDate);

  // ──── Items Table ────
  y = Math.max(y, ry) + 12;

  const cols = [
    { label: "SL No", x: marginL, w: 14 },
    { label: "Link ID", x: marginL + 14, w: 24 },
    { label: "Bill Type", x: marginL + 38, w: 28 },
    { label: "Package/Bandwidth", x: marginL + 66, w: 38 },
    { label: "Amount", x: marginL + 104, w: 24 },
    { label: "Bill Duration", x: marginL + 128, w: 32 },
    { label: "Total Amount", x: marginL + 160, w: contentW - 160 },
  ];

  const headerH = 8;
  doc.setFillColor(245, 245, 245);
  doc.rect(marginL, y - 5, contentW, headerH, "F");
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginL, y - 5, marginR, y - 5);
  doc.line(marginL, y + headerH - 5, marginR, y + headerH - 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  cols.forEach((col) => {
    doc.text(col.label, col.x + col.w / 2, y, { align: "center" });
  });

  y += headerH;

  const rowH = 10;
  doc.line(marginL, y + rowH - 5, marginR, y + rowH - 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  doc.text("1", cols[0].x + cols[0].w / 2, y + 1, { align: "center" });
  doc.text(customer?.customer_id || "—", cols[1].x + cols[1].w / 2, y + 1, { align: "center" });
  doc.text("Monthly Bill", cols[2].x + cols[2].w / 2, y + 1, { align: "center" });
  const pkgName = customer?.packages?.name || customer?.package_name || "—";
  doc.text(pkgName, cols[3].x + cols[3].w / 2, y + 1, { align: "center" });
  doc.text(String(Number(bill.amount).toLocaleString()), cols[4].x + cols[4].w / 2, y + 1, { align: "center" });

  let billDuration = "—";
  if (bill.month) {
    try {
      const [yr, mn] = bill.month.split("-").map(Number);
      const start = new Date(yr, mn - 1, 1);
      const end = new Date(yr, mn, 0);
      billDuration = `${format(start, "dd-MMM-yyyy")} To ${format(end, "dd-MMM-yyyy")}`;
    } catch {
      billDuration = bill.month;
    }
  }
  const durLines = doc.splitTextToSize(billDuration, cols[5].w - 2);
  doc.text(durLines, cols[5].x + cols[5].w / 2, y - 1, { align: "center" });
  const totalAmount = Number(bill.amount);
  doc.text(totalAmount.toFixed(2), cols[6].x + cols[6].w / 2, y + 1, { align: "center" });

  y += rowH;

  // ──── Summary rows ────
  y += 3;
  const summaryLabelX = marginL + 104;
  const summaryValueX = marginR;

  const summaryRow = (label: string, value: string, bold = false) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(label, summaryValueX - 20, y, { align: "right" });
    doc.text(value, summaryValueX, y, { align: "right" });
    doc.setDrawColor(200, 200, 200);
    doc.line(summaryLabelX, y + 2, marginR, y + 2);
    y += 7;
  };

  summaryRow("Including VAT Total Amount:", totalAmount.toFixed(2));
  summaryRow("Previous Balance:", previousBalance.toFixed(2));
  const totalPayable = totalAmount + previousBalance;
  summaryRow("Total Payable Amount / Current Balance:", totalPayable.toFixed(2), true);

  // ──── Payment Info Section (from invoice settings) ────
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  if (vatReg) {
    doc.setFont("helvetica", "normal");
    doc.text(`${companyName} VAT Registration Number: ${vatReg}`, marginL, y);
    y += 6;
  }

  // Available Payment Method header
  doc.setFont("helvetica", "bold");
  doc.text("Available Payment Method:", marginL, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");

  if (chequeText) {
    doc.text(chequeText, marginL, y);
    y += 4.5;
  }

  // Bank accounts
  bankAccounts.filter(b => b.bank_name).forEach((bank) => {
    doc.text(`${bank.bank_name}: ${bank.account_no}`, marginL, y);
    y += 4.5;
  });

  if (bkashMerchant) {
    doc.text(`bKash Merchant Account Number: ${bkashMerchant}`, marginL, y);
    y += 4.5;
  }
  if (nagadMerchant) {
    doc.text(`Nagad Merchant Number: ${nagadMerchant}`, marginL, y);
    y += 4.5;
  }
  if (rocketBillerId) {
    doc.text(`Rocket Biller ID: ${rocketBillerId}`, marginL, y);
    y += 4.5;
  }
  if (visaCardInfo) {
    const visaLines = doc.splitTextToSize(visaCardInfo, contentW);
    doc.text(visaLines, marginL, y);
    y += 4.5 * visaLines.length;
  }

  if (techSupport) {
    y += 2;
    doc.text(`24/7 Technical Support: ${techSupport}`, marginL, y);
    y += 4.5;
  }

  // ──── Footer NB note ────
  const footerY = ph - 30;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `NB: This Invoice has been generated by Software, its valid without any signature and seal. For any query regarding this invoice please contact ${techSupport || companyPhone || "support"}`,
    pw / 2,
    footerY,
    { align: "center", maxWidth: contentW }
  );

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginL, footerY + 6, marginR, footerY + 6);

  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");
  if (companyAddress) {
    doc.text(companyAddress, pw / 2, footerY + 11, { align: "center", maxWidth: contentW });
  }
  const contactLine = [companyPhone ? `Phone: ${companyPhone}` : "", companyEmail ? `Email: ${companyEmail}` : ""].filter(Boolean).join(", ");
  if (contactLine) {
    doc.text(contactLine, pw / 2, footerY + 15, { align: "center" });
  }

  const fileName = `Invoice-${bill.month}-${customer?.customer_id || bill.id?.substring(0, 8)}.pdf`;
  doc.save(fileName);
}
