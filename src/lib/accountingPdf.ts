import jsPDF from "jspdf";
import { PDF_COLORS, PDF_FONT, PDF_SPACING, drawCompanyHeader, drawSectionHeader, drawFooter, fmtCurrency, numberToWords } from "./pdfTheme";

// ═══════════════════════════════════════════════════════════════
// Payment Advice
// ═══════════════════════════════════════════════════════════════
export function generatePaymentAdvicePDF(supplier: any, payment: any, remainingDue: number) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;

  let y = drawCompanyHeader(doc, {
    companyName: "Smart ISP",
    subtitle: "Internet Service Provider",
    docTitle: "PAYMENT ADVICE",
    docMeta: [`Date: ${new Date(payment.paid_date || payment.date || new Date()).toLocaleDateString("en-GB")}`],
    style: "banner",
  });

  y += 4;
  doc.setFontSize(PDF_FONT.subtitle);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("Paid To:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text(supplier?.name || "—", m + 25, y);
  y += 7;
  if (supplier?.company) { doc.setFontSize(PDF_FONT.body); doc.text(`Company: ${supplier.company}`, m, y); y += 6; }
  if (supplier?.phone) { doc.setFontSize(PDF_FONT.body); doc.text(`Phone: ${supplier.phone}`, m, y); y += 6; }
  y += 6;

  // Table
  doc.setFillColor(...PDF_COLORS.bgLight);
  doc.rect(m, y, pw - m * 2, 9, "F");
  doc.setDrawColor(...PDF_COLORS.border);
  doc.rect(m, y, pw - m * 2, 9, "S");
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("Description", m + 4, y + 6);
  doc.text("Amount", pw - m - 4, y + 6, { align: "right" });
  y += 13;

  doc.setFont("helvetica", "normal");
  const desc = payment.purchase_no ? `Payment against Invoice #${payment.purchase_no}` : `Supplier Payment - ${payment.payment_method}`;
  doc.text(desc, m + 4, y);
  doc.text(fmtCurrency(Number(payment.amount)), pw - m - 4, y, { align: "right" });
  y += 7;
  if (payment.reference) { doc.text(`Reference: ${payment.reference}`, m + 4, y); y += 7; }
  y += 4;

  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m, y, pw - m, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONT.heading);
  doc.text("Total Paid:", m + 4, y);
  doc.text(fmtCurrency(Number(payment.amount)), pw - m - 4, y, { align: "right" });
  y += 7;
  doc.text("Remaining Due:", m + 4, y);
  doc.setTextColor(remainingDue > 0 ? PDF_COLORS.danger[0] : PDF_COLORS.success[0], remainingDue > 0 ? PDF_COLORS.danger[1] : PDF_COLORS.success[1], remainingDue > 0 ? PDF_COLORS.danger[2] : PDF_COLORS.success[2]);
  doc.text(fmtCurrency(Math.max(0, remainingDue)), pw - m - 4, y, { align: "right" });

  drawFooter(doc, { noteText: "This is a computer-generated payment advice. No signature required." });
  doc.save(`payment-advice-${supplier?.name || "supplier"}-${Date.now()}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// Profit & Loss Statement
// ═══════════════════════════════════════════════════════════════
interface MonthlyPLRow { month: string; income: number; expense: number; profit: number; }

export function generateProfitLossPDF(
  data: MonthlyPLRow[], year: string,
  totals: { income: number; expense: number; profit: number }
) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;

  let y = drawCompanyHeader(doc, {
    companyName: "Smart ISP",
    subtitle: `Financial Year: ${year}`,
    docTitle: "PROFIT & LOSS STATEMENT",
    docMeta: [`Generated: ${new Date().toLocaleDateString("en-GB")}`],
    style: "banner",
  });

  // Summary cards
  const cardW = (pw - m * 2 - 14) / 3;
  const cards = [
    { label: "Total Income", value: totals.income, color: PDF_COLORS.success },
    { label: "Total Expense", value: totals.expense, color: PDF_COLORS.danger },
    { label: "Net Profit", value: totals.profit, color: totals.profit >= 0 ? PDF_COLORS.success : PDF_COLORS.danger },
  ];
  cards.forEach((c, i) => {
    const x = m + i * (cardW + 7);
    doc.setFillColor(...PDF_COLORS.bgLight);
    doc.roundedRect(x, y, cardW, 20, 2, 2, "F");
    doc.setFontSize(PDF_FONT.small);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(c.label, x + 5, y + 7);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...c.color);
    doc.text(fmtCurrency(c.value), x + 5, y + 16);
  });
  y += 30;

  // Table
  const cols = [m + 4, m + 55, m + 100, m + 145];
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(m, y, pw - m * 2, 9, "F");
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("Month", cols[0], y + 6);
  doc.text("Income (৳)", cols[1], y + 6);
  doc.text("Expense (৳)", cols[2], y + 6);
  doc.text("Profit/Loss (৳)", cols[3], y + 6);
  y += 12;

  doc.setFont("helvetica", "normal");
  data.forEach((row, i) => {
    if (i % 2 === 0) { doc.setFillColor(...PDF_COLORS.bgRow); doc.rect(m, y - 4, pw - m * 2, 8, "F"); }
    doc.setFontSize(PDF_FONT.body);
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(`${row.month} ${year}`, cols[0], y);
    doc.text(row.income.toLocaleString(), cols[1], y);
    doc.text(row.expense.toLocaleString(), cols[2], y);
    doc.setTextColor(row.profit >= 0 ? PDF_COLORS.success[0] : PDF_COLORS.danger[0], row.profit >= 0 ? PDF_COLORS.success[1] : PDF_COLORS.danger[1], row.profit >= 0 ? PDF_COLORS.success[2] : PDF_COLORS.danger[2]);
    doc.text(row.profit.toLocaleString(), cols[3], y);
    y += 8;
  });

  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m, y - 2, pw - m, y - 2);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONT.heading);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("TOTAL", cols[0], y);
  doc.text(totals.income.toLocaleString(), cols[1], y);
  doc.text(totals.expense.toLocaleString(), cols[2], y);
  doc.setTextColor(totals.profit >= 0 ? PDF_COLORS.success[0] : PDF_COLORS.danger[0], totals.profit >= 0 ? PDF_COLORS.success[1] : PDF_COLORS.danger[1], totals.profit >= 0 ? PDF_COLORS.success[2] : PDF_COLORS.danger[2]);
  doc.text(totals.profit.toLocaleString(), cols[3], y);

  drawFooter(doc, { noteText: "This is a computer-generated document. No signature required." });
  doc.save(`profit-loss-${year}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// Purchase Invoice
// ═══════════════════════════════════════════════════════════════
export function generatePurchaseInvoicePDF(purchase: any, supplier?: any) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;

  let y = drawCompanyHeader(doc, {
    companyName: "Smart ISP",
    subtitle: "Internet Service Provider",
    docTitle: "PURCHASE INVOICE",
    docMeta: [`Invoice: ${purchase.purchase_no || "—"}`, `Date: ${purchase.date ? new Date(purchase.date).toLocaleDateString("en-GB") : "—"}`],
    style: "banner",
  });

  // Supplier info
  y = drawSectionHeader(doc, "Supplier Information", y);
  const fieldRow = (label: string, value: string) => {
    doc.setFontSize(PDF_FONT.small);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(label, m + 4, y);
    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(value || "—", m + 40, y);
    y += 6.5;
  };
  fieldRow("Supplier", supplier?.name || purchase.supplier_name || "—");
  if (supplier?.company) fieldRow("Company", supplier.company);
  if (supplier?.phone) fieldRow("Phone", supplier.phone);
  fieldRow("Status", (purchase.status || "unpaid").toUpperCase());
  y += 4;

  // Items table
  const itemCols = [m + 4, m + 74, m + 104, m + 140];
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(m, y, pw - m * 2, 8, "F");
  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("Product", itemCols[0], y + 5.5);
  doc.text("Qty", itemCols[1], y + 5.5);
  doc.text("Price", itemCols[2], y + 5.5);
  doc.text("Total", itemCols[3], y + 5.5);
  y += 11;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.text);
  const items = purchase.items || purchase.purchase_items || [];
  if (items.length === 0) {
    doc.setFontSize(PDF_FONT.body); doc.text("No items", m + 4, y); y += 8;
  } else {
    items.forEach((item: any, i: number) => {
      if (i % 2 === 0) { doc.setFillColor(...PDF_COLORS.bgRow); doc.rect(m, y - 4, pw - m * 2, 8, "F"); }
      doc.setFontSize(PDF_FONT.body); doc.setTextColor(...PDF_COLORS.text);
      doc.text((item.product?.name || item.product_name || "Product").substring(0, 35), itemCols[0], y);
      doc.text(String(item.quantity || 0), itemCols[1], y);
      doc.text(fmtCurrency(Number(item.unit_price || 0)), itemCols[2], y);
      doc.text(fmtCurrency(Number(item.quantity * item.unit_price || 0)), itemCols[3], y);
      y += 8;
    });
  }

  y += 4;
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m + 80, y, pw - m, y);
  y += 7;

  const total = Number(purchase.total_amount || 0);
  const paid = Number(purchase.paid_amount || 0);
  const due = total - paid;

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFontSize(bold ? PDF_FONT.subtitle : PDF_FONT.body);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, m + 110, y);
    doc.text(value, pw - m - 4, y, { align: "right" });
    y += bold ? 8 : 7;
  };

  doc.setTextColor(...PDF_COLORS.text);
  totalRow("Total:", fmtCurrency(total), true);
  totalRow("Paid:", fmtCurrency(paid));
  if (due > 0) { doc.setTextColor(...PDF_COLORS.danger); totalRow("Due:", fmtCurrency(due), true); }

  drawFooter(doc, { noteText: "This is a computer-generated invoice. No signature required." });
  doc.save(`purchase-${purchase.purchase_no || purchase.id?.substring(0, 8)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// Sales Invoice
// ═══════════════════════════════════════════════════════════════
export function generateSalesInvoicePDF(sale: any) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;

  let y = drawCompanyHeader(doc, {
    companyName: "Smart ISP",
    subtitle: "Internet Service Provider",
    docTitle: "SALES INVOICE",
    docMeta: [`Invoice: ${sale.invoice_number || sale.sale_no || "—"}`, `Date: ${sale.sale_date || "—"}`],
    style: "banner",
  });

  // Customer info
  y = drawSectionHeader(doc, "Customer Information", y);
  const fieldRow = (label: string, value: string) => {
    doc.setFontSize(PDF_FONT.small);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(label, m + 4, y);
    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(value || "—", m + 40, y);
    y += 6.5;
  };
  fieldRow("Customer", sale.customer_name || sale.customer?.name || "—");
  fieldRow("Phone", sale.customer_phone || "—");
  fieldRow("Payment", (sale.payment_method || "cash").toUpperCase());
  fieldRow("Status", (sale.status || "pending").toUpperCase());
  y += 4;

  // Items
  const itemCols = [m + 4, m + 74, m + 104, m + 140];
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(m, y, pw - m * 2, 8, "F");
  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("Product", itemCols[0], y + 5.5);
  doc.text("Qty", itemCols[1], y + 5.5);
  doc.text("Price", itemCols[2], y + 5.5);
  doc.text("Total", itemCols[3], y + 5.5);
  y += 11;

  doc.setFont("helvetica", "normal");
  const saleItems = sale.items || sale.sale_items || [];
  if (saleItems.length === 0) {
    doc.setFontSize(PDF_FONT.body); doc.text("No items", m + 4, y); y += 8;
  } else {
    saleItems.forEach((item: any, i: number) => {
      if (i % 2 === 0) { doc.setFillColor(...PDF_COLORS.bgRow); doc.rect(m, y - 4, pw - m * 2, 8, "F"); }
      doc.setFontSize(PDF_FONT.body); doc.setTextColor(...PDF_COLORS.text);
      doc.text((item.product?.name || item.product_name || "Product").substring(0, 35), itemCols[0], y);
      doc.text(String(item.quantity || 0), itemCols[1], y);
      doc.text(fmtCurrency(Number(item.unit_price || 0)), itemCols[2], y);
      doc.text(fmtCurrency(Number(item.total || (item.quantity * item.unit_price) || 0)), itemCols[3], y);
      y += 8;
    });
  }

  y += 4;
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m + 80, y, pw - m, y);
  y += 7;

  const subtotal = Number(sale.subtotal || sale.total || 0);
  const discount = Number(sale.discount || 0);
  const tax = Number(sale.tax || 0);
  const total = Number(sale.total || 0);
  const paid = Number(sale.paid_amount || 0);
  const due = Number(sale.due_amount || total - paid);

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFontSize(bold ? PDF_FONT.subtitle : PDF_FONT.body);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, m + 110, y);
    doc.text(value, pw - m - 4, y, { align: "right" });
    y += bold ? 8 : 7;
  };

  doc.setTextColor(...PDF_COLORS.text);
  totalRow("Subtotal:", fmtCurrency(subtotal));
  if (discount > 0) totalRow("Discount:", `-${fmtCurrency(discount)}`);
  if (tax > 0) totalRow("Tax:", fmtCurrency(tax));
  totalRow("Total:", fmtCurrency(total), true);
  totalRow("Paid:", fmtCurrency(paid));
  if (due > 0) { doc.setTextColor(...PDF_COLORS.danger); totalRow("Due:", fmtCurrency(due), true); }

  drawFooter(doc, { noteText: "This is a computer-generated invoice. No signature required." });
  doc.save(`invoice-${sale.invoice_number || sale.sale_no || sale.id?.substring(0, 8)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// Transaction Voucher
// ═══════════════════════════════════════════════════════════════
export function generateTransactionVoucherPDF(txn: any, account?: any) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;

  const voucherType = txn.type === "income" ? "Credit Voucher"
    : txn.type === "expense" ? "Debit Voucher"
    : txn.type === "journal" ? "Journal Voucher"
    : "Transaction Voucher";

  let y = drawCompanyHeader(doc, {
    companyName: "Smart ISP",
    subtitle: "Internet Service Provider",
    docTitle: voucherType.toUpperCase(),
    docMeta: [
      `Voucher No: ${txn.journal_ref || txn.id?.substring(0, 8) || "—"}`,
      `Date: ${txn.date ? new Date(txn.date).toLocaleDateString("en-GB") : "—"}`,
    ],
    style: "banner",
  });

  // Info
  const infoRow = (label: string, value: string) => {
    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(label, m + 4, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(value || "—", m + 50, y);
    y += 7;
  };

  infoRow("Type:", (txn.type || "").toUpperCase());
  infoRow("Category:", (txn.category || "").toUpperCase());
  infoRow("Account:", account ? `${account.code} - ${account.name}` : "—");
  if (txn.reference_type) infoRow("Reference:", `${txn.reference_type} / ${txn.reference_id || ""}`);
  y += 6;

  // Amount table
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(m, y, pw - m * 2, 9, "F");
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.white);
  doc.text("Description", m + 4, y + 6);
  doc.text("Debit (৳)", pw - m - 50, y + 6, { align: "right" });
  doc.text("Credit (৳)", pw - m - 4, y + 6, { align: "right" });
  y += 13;

  doc.setFillColor(...PDF_COLORS.bgRow);
  doc.rect(m, y - 5, pw - m * 2, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFontSize(PDF_FONT.heading);
  doc.text(txn.description || "Transaction", m + 4, y);
  doc.text(Number(txn.debit) > 0 ? Number(txn.debit).toLocaleString() : "—", pw - m - 50, y, { align: "right" });
  doc.text(Number(txn.credit) > 0 ? Number(txn.credit).toLocaleString() : "—", pw - m - 4, y, { align: "right" });
  y += 12;

  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m, y, pw - m, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONT.subtitle);
  doc.text("Total Amount:", m + 4, y);
  doc.text(fmtCurrency(Number(txn.amount || 0)), pw - m - 4, y, { align: "right" });
  y += 12;

  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text("Amount (in words):", m + 4, y);
  doc.setFont("helvetica", "normal");
  doc.text(numberToWords(Number(txn.amount || 0)) + " Taka Only", m + 46, y);

  // Signatures
  y = 225;
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineDashPattern([2, 2], 0);
  const sigX = [m + 18, pw / 2, pw - m - 30];
  const sigLabels = ["Prepared By", "Checked By", "Approved By"];
  sigLabels.forEach((label, i) => {
    doc.line(sigX[i] - 20, y, sigX[i] + 20, y);
    doc.setFontSize(PDF_FONT.small);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(label, sigX[i], y + 6, { align: "center" });
  });
  doc.setLineDashPattern([], 0);

  drawFooter(doc, { noteText: "This is a computer-generated voucher. No signature required for amounts below ৳10,000." });
  doc.save(`voucher-${txn.type}-${txn.id?.substring(0, 8) || Date.now()}.pdf`);
}
