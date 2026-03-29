import jsPDF from "jspdf";
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

export async function generatePaymentReceiptPDF(payment: any, customer: any, invoiceFooter?: string) {
  const [settings, invoiceSettings] = await Promise.all([
    getCompanySettings(),
    getInvoiceSettings(),
  ]);

  const companyName = settings?.site_name || "Smart ISP";
  const companyAddress = settings?.address || "";
  const companyPhone = settings?.mobile || settings?.support_phone || "";
  const companyEmail = settings?.email || settings?.support_email || "";

  const chequeText = invoiceSettings.invoice_cheque_text || "";
  let bankAccounts: { bank_name: string; account_no: string }[] = [];
  try { bankAccounts = JSON.parse(invoiceSettings.invoice_bank_accounts || "[]"); } catch { bankAccounts = []; }
  const bkashMerchant = invoiceSettings.invoice_bkash_merchant || "";
  const nagadMerchant = invoiceSettings.invoice_nagad_merchant || "";
  const rocketBillerId = invoiceSettings.invoice_rocket_biller_id || "";
  const visaCardInfo = invoiceSettings.invoice_visa_card_info || "";
  const techSupport = invoiceSettings.invoice_tech_support || settings?.support_phone || companyPhone || "";

  const receiptNo = `PMT#${(payment.id || "00000000").substring(0, 10).toUpperCase()}`;
  const paymentDate = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const marginL = 18;
  const marginR = pw - 18;
  const contentW = marginR - marginL;

  // ──── Company Logo/Name top-right ────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(companyName, marginR, 22, { align: "right" });
  if (companyAddress) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(companyAddress, marginR, 28, { align: "right" });
  }

  // ──── "Payment Receipt" title centered ────
  let y = 40;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, marginR, y);
  y += 8;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Payment Receipt", pw / 2, y, { align: "center" });
  y += 6;
  doc.line(marginL, y, marginR, y);
  y += 14;

  // ──── Client Info (left) + Payment Statement (right) ────
  const leftX = marginL;
  const rightX = pw / 2 + 14;

  // Left: Client's Information
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Client's Information", leftX, y);
  doc.setLineWidth(0.3);
  doc.line(leftX, y + 2, leftX + 48, y + 2);
  y += 10;

  const clientFields = [
    { label: "Client ID:", value: customer?.customer_id || "—" },
    { label: "Client Name:", value: customer?.name || "—" },
    { label: "Billing Address:", value: [customer?.house ? `House# ${customer.house}` : "", customer?.road ? `Road# ${customer.road}` : "", customer?.area || ""].filter(Boolean).join(", ") || "—" },
    { label: "Mobile No:", value: customer?.phone || "—" },
    { label: "Email:", value: customer?.email || "—" },
  ];

  doc.setFontSize(9);
  const clientY = y;
  clientFields.forEach((f) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(f.label, leftX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(f.value, leftX + 38, y);
    y += 7;
  });

  // Right: Payment Statement
  let ry = clientY - 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Payment Statement", rightX, ry);
  doc.setLineWidth(0.3);
  doc.line(rightX, ry + 2, rightX + 48, ry + 2);
  ry += 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Receipt No:", rightX, ry);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(receiptNo, rightX + 30, ry);
  ry += 7;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Payment Date:", rightX, ry);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(paymentDate, rightX + 30, ry);
  ry += 7;

  y = Math.max(y, ry) + 14;

  // ──── Payment Details Table ────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Payment Details:", marginL, y);
  y += 8;

  // Table
  const colW1 = contentW / 2;
  const colW2 = contentW / 2;
  const rowH = 10;

  const drawTableRow = (label: string, value: string, isHeader = false) => {
    doc.setDrawColor(150, 150, 150);
    doc.rect(marginL, y, colW1, rowH, "S");
    doc.rect(marginL + colW1, y, colW2, rowH, "S");

    if (isHeader) {
      doc.setFillColor(240, 240, 240);
      doc.rect(marginL, y, colW1, rowH, "F");
      doc.rect(marginL + colW1, y, colW2, rowH, "F");
      doc.setDrawColor(150, 150, 150);
      doc.rect(marginL, y, colW1, rowH, "S");
      doc.rect(marginL + colW1, y, colW2, rowH, "S");
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", isHeader ? "bold" : "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(label, marginL + 4, y + 7);
    doc.text(value, marginL + colW1 + 4, y + 7);
    y += rowH;
  };

  const formatPaymentMethod = (method: string) => {
    const map: Record<string, string> = {
      cash: "Cash",
      bkash: "Bkash",
      nagad: "Nagad",
      bank: "Bank Transfer",
      "brac bank": "Brac Bank",
      "brac_bank": "Brac Bank",
    };
    return map[method?.toLowerCase()] || method || "—";
  };

  drawTableRow("Payment Mode", "Prepaid");
  drawTableRow("Payment Method", formatPaymentMethod(payment.payment_method));
  drawTableRow("Paid Amount", `${Number(payment.amount).toFixed(2)} tk`);
  drawTableRow("Received By", payment.transaction_id || payment.bkash_trx_id || "—");

  y += 15;

  // ──── Available Payment Methods ────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Available Payment Method:", marginL, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const paymentLines: string[] = [];
  if (chequeText) paymentLines.push(chequeText);
  bankAccounts.forEach((acc) => {
    if (acc.bank_name && acc.account_no) {
      paymentLines.push(`${acc.bank_name}: ${acc.account_no}`);
    }
  });
  if (bkashMerchant) paymentLines.push(`bKash: Merchant Account Number: ${bkashMerchant}`);
  if (nagadMerchant) paymentLines.push(`Nagad: Merchant Account Number: ${nagadMerchant}`);
  if (rocketBillerId) paymentLines.push(`Rocket: Biller ID: ${rocketBillerId}`);
  if (visaCardInfo) paymentLines.push(visaCardInfo);

  paymentLines.forEach((line) => {
    doc.text(line, marginL, y);
    y += 5;
  });

  if (techSupport) {
    y += 3;
    doc.text(`24/7 Technical Support: ${techSupport}`, marginL, y);
    y += 5;
  }

  // ──── NB Footer ────
  const nbY = ph - 30;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.line(marginL, nbY, marginR, nbY);

  const footerNb = invoiceFooter || invoiceSettings.invoice_footer ||
    "NB: This Invoice has been generated by Software, its valid without any signature and seal.";
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(80, 80, 80);
  doc.text(footerNb, marginL, nbY + 5);

  // ──── Bottom Company Info ────
  doc.setDrawColor(60, 60, 60);
  doc.line(marginL, ph - 18, marginR, ph - 18);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const bottomParts: string[] = [];
  if (companyAddress) bottomParts.push(companyAddress);
  const bottomLine1 = bottomParts.join("");
  if (bottomLine1) {
    doc.text(bottomLine1, pw / 2, ph - 13, { align: "center" });
  }

  const contactParts: string[] = [];
  if (companyPhone) contactParts.push(`Phone: ${companyPhone}`);
  if (companyEmail) contactParts.push(`Email: ${companyEmail}`);
  if (contactParts.length > 0) {
    doc.text(contactParts.join(", "), pw / 2, ph - 8, { align: "center" });
  }

  doc.save(`receipt-${receiptNo}.pdf`);
}

export function generateCustomerPDF(customer: any, invoiceFooter?: string) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pw - margin * 2;
  let y = 0;

  const navy = [20, 50, 120] as const;
  const lightBg = [245, 247, 250] as const;
  const borderGray = [200, 200, 200] as const;

  // ─── HEADER ───
  doc.setFillColor(...navy);
  doc.rect(0, 0, pw, 38, "F");

  doc.setFillColor(255, 255, 255);
  doc.circle(28, 19, 10, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text("ISP", 23, 22);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Smart ISP", 45, 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Internet Service Provider", 45, 22);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("APPLICATION FORM", pw - 20, 14, { align: "right" });
  doc.setDrawColor(255, 255, 255);
  doc.roundedRect(pw - 62, 6, 48, 12, 2, 2, "S");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Form No: ${customer.customer_id || "—"}`, pw - 20, 26, { align: "right" });
  doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, pw - 20, 32, { align: "right" });

  y = 44;

  // ─── HELPERS ───
  const sectionHeader = (title: string) => {
    doc.setFillColor(...navy);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 4, y + 5);
    y += 10;
    doc.setTextColor(30, 30, 30);
  };

  const fieldBox = (label: string, value: string, x: number, w: number, h = 10) => {
    doc.setDrawColor(...borderGray);
    doc.rect(x, y, w, h, "S");
    doc.setFillColor(...lightBg);
    doc.rect(x, y, w, 4, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(label, x + 2, y + 3);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    doc.text(value || "—", x + 2, y + 8);
  };

  const fieldRow = (fields: { label: string; value: string }[], h = 10) => {
    const fw = contentW / fields.length;
    fields.forEach((f, i) => fieldBox(f.label, f.value, margin + fw * i, fw, h));
    y += h + 1;
  };

  // ─── CUSTOMER INFORMATION ───
  sectionHeader("Customer Information");

  fieldRow([
    { label: "Applicant Name", value: customer.name || "" },
    { label: "Father Name", value: customer.father_name || "" },
  ]);

  fieldRow([
    { label: "Customer ID", value: customer.customer_id || "" },
    { label: "National ID", value: customer.nid || "" },
    { label: "Email", value: customer.email || "" },
  ]);

  fieldRow([
    { label: "Mobile Number", value: customer.phone || "" },
    { label: "Alternative Contact", value: customer.alt_phone || "" },
    { label: "Occupation", value: customer.occupation || "" },
    { label: "Mother Name", value: customer.mother_name || "" },
  ]);

  y += 3;

  // ─── ADDRESS INFORMATION ───
  sectionHeader("Address Information");

  fieldRow([
    { label: "Zone / Area", value: customer.area || "" },
    { label: "Road No", value: customer.road || "" },
    { label: "House No", value: customer.house || "" },
    { label: "City", value: customer.city || "" },
  ]);

  fieldBox("Permanent Address", customer.permanent_address || "", margin, contentW, 12);
  y += 13;

  y += 3;

  // ─── CONNECTION DETAILS ───
  sectionHeader("Connection Details");

  fieldRow([
    { label: "Package Name", value: customer.packages?.name || "" },
    { label: "Speed", value: customer.packages?.speed || "" },
  ]);

  fieldRow([
    { label: "PPPoE Username", value: customer.pppoe_username || "" },
    { label: "PPPoE Password", value: customer.pppoe_password || "" },
  ]);

  fieldRow([
    { label: "IP Address", value: customer.ip_address || "" },
    { label: "Gateway", value: customer.gateway || "" },
    { label: "Subnet", value: customer.subnet || "" },
  ]);

  fieldRow([
    { label: "ONU MAC", value: customer.onu_mac || "" },
    { label: "Router MAC", value: customer.router_mac || "" },
  ]);

  y += 3;

  // ─── BILLING INFORMATION ───
  sectionHeader("Billing Information");

  const monthlyBill = Number(customer.monthly_bill || 0);
  const discount = Number(customer.discount || 0);
  const totalAmount = monthlyBill - discount;

  fieldRow([
    { label: "Connection Date", value: customer.installation_date || "" },
    { label: "Monthly Bill", value: `${monthlyBill.toLocaleString()} BDT` },
    { label: "Due Date (Day)", value: customer.due_date_day ? `${customer.due_date_day}th of every month` : "—" },
  ]);

  fieldRow([
    { label: "Discount", value: `${discount.toLocaleString()} BDT` },
    { label: "Total Amount", value: `${totalAmount.toLocaleString()} BDT` },
  ]);

  y += 3;

  // ─── OFFICE USE ───
  sectionHeader("Office Use Only");

  fieldRow([
    { label: "POP Location", value: customer.pop_location || "" },
    { label: "Installed By", value: customer.installed_by || "" },
    { label: "Box Name", value: customer.box_name || "" },
    { label: "Cable Length", value: customer.cable_length || "" },
  ]);

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  y += 8;

  // ─── SIGNATURES ───
  doc.setDrawColor(...borderGray);
  const sigW = (contentW - 10) / 3;

  [
    { label: "Applicant Signature", x: margin },
    { label: "Admin Signature", x: margin + sigW + 5 },
    { label: "Marketing Signature", x: margin + (sigW + 5) * 2 },
  ].forEach(({ label, x }) => {
    doc.line(x, y + 15, x + sigW, y + 15);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(label, x + sigW / 2, y + 20, { align: "center" });
  });

  y += 28;

  const termsText = invoiceFooter || "I hereby declare that all the information provided above is correct to the best of my knowledge.";
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(termsText, margin, y);
  doc.text("The ISP reserves the right to suspend the connection in case of non-payment or violation of terms.", margin, y + 4);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} — Smart ISP Billing System`,
    pw / 2, 288, { align: "center" }
  );

  doc.save(`${customer.customer_id || "customer"}-application-form.pdf`);
}
