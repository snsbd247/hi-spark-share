import jsPDF from "jspdf";

interface MonthlyPLRow {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

export function generateProfitLossPDF(
  data: MonthlyPLRow[],
  year: string,
  totals: { income: number; expense: number; profit: number }
) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const navy = [20, 50, 120] as const;

  // Header
  doc.setFillColor(...navy);
  doc.rect(0, 0, pw, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Profit & Loss Statement", 15, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Financial Year: ${year}`, 15, 28);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, pw - 15, 28, { align: "right" });

  let y = 50;

  // Summary cards
  const cardW = (pw - 45) / 3;
  const cards = [
    { label: "Total Income", value: totals.income, color: [34, 197, 94] as const },
    { label: "Total Expense", value: totals.expense, color: [239, 68, 68] as const },
    { label: "Net Profit", value: totals.profit, color: totals.profit >= 0 ? [34, 197, 94] as const : [239, 68, 68] as const },
  ];
  cards.forEach((c, i) => {
    const x = 15 + i * (cardW + 7.5);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(x, y, cardW, 22, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(c.label, x + 5, y + 8);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(`৳${c.value.toLocaleString()}`, x + 5, y + 18);
  });

  y += 35;

  // Table header
  doc.setFillColor(...navy);
  doc.rect(15, y, pw - 30, 9, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  const cols = [20, 70, 110, 150];
  doc.text("Month", cols[0], y + 6);
  doc.text("Income (৳)", cols[1], y + 6);
  doc.text("Expense (৳)", cols[2], y + 6);
  doc.text("Profit/Loss (৳)", cols[3], y + 6);
  y += 12;

  // Table rows
  doc.setFont("helvetica", "normal");
  data.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 4, pw - 30, 8, "F");
    }
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`${row.month} ${year}`, cols[0], y);
    doc.text(row.income.toLocaleString(), cols[1], y);
    doc.text(row.expense.toLocaleString(), cols[2], y);
    doc.setTextColor(row.profit >= 0 ? 34 : 239, row.profit >= 0 ? 120 : 68, row.profit >= 0 ? 60 : 68);
    doc.text(row.profit.toLocaleString(), cols[3], y);
    y += 8;
  });

  // Total row
  doc.setDrawColor(100, 100, 100);
  doc.line(15, y - 2, pw - 15, y - 2);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("TOTAL", cols[0], y);
  doc.text(totals.income.toLocaleString(), cols[1], y);
  doc.text(totals.expense.toLocaleString(), cols[2], y);
  doc.setTextColor(totals.profit >= 0 ? 34 : 239, totals.profit >= 0 ? 120 : 68, totals.profit >= 0 ? 60 : 68);
  doc.text(totals.profit.toLocaleString(), cols[3], y);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated document. No signature required.", pw / 2, 280, { align: "center" });

  doc.save(`profit-loss-${year}.pdf`);
}

export function generateSalesInvoicePDF(sale: any) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const navy = [20, 50, 120] as const;

  // Header
  doc.setFillColor(...navy);
  doc.rect(0, 0, pw, 42, "F");

  doc.setFillColor(255, 255, 255);
  doc.circle(28, 21, 10, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text("ISP", 23, 24);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Smart ISP", 45, 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Internet Service Provider", 45, 22);

  // Invoice badge
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SALES INVOICE", pw - 15, 14, { align: "right" });
  doc.setDrawColor(255, 255, 255);
  doc.roundedRect(pw - 60, 6, 48, 12, 2, 2, "S");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice: ${sale.invoice_number || "—"}`, pw - 15, 28, { align: "right" });
  doc.text(`Date: ${sale.sale_date || "—"}`, pw - 15, 34, { align: "right" });

  let y = 52;

  // Customer info
  doc.setFillColor(...navy);
  doc.rect(15, y, pw - 30, 7, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("CUSTOMER INFORMATION", 19, y + 5);
  y += 10;

  doc.setTextColor(30, 30, 30);
  const fieldRow = (label: string, value: string) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(label, 20, y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(value || "—", 70, y);
    y += 7;
  };

  fieldRow("Customer", sale.customer_name || sale.customer?.name || "—");
  fieldRow("Phone", sale.customer_phone || "—");
  fieldRow("Payment", (sale.payment_method || "cash").toUpperCase());
  fieldRow("Status", (sale.status || "pending").toUpperCase());
  y += 5;

  // Items table
  doc.setFillColor(...navy);
  doc.rect(15, y, pw - 30, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  const itemCols = [20, 90, 120, 155];
  doc.text("Product", itemCols[0], y + 5.5);
  doc.text("Qty", itemCols[1], y + 5.5);
  doc.text("Price", itemCols[2], y + 5.5);
  doc.text("Total", itemCols[3], y + 5.5);
  y += 11;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const saleItems = sale.items || sale.sale_items || [];
  if (saleItems.length === 0) {
    doc.setFontSize(9);
    doc.text("No items", 20, y);
    y += 8;
  } else {
    saleItems.forEach((item: any, i: number) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y - 4, pw - 30, 8, "F");
      }
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      const prodName = item.product?.name || item.product_name || `Product`;
      doc.text(prodName.substring(0, 35), itemCols[0], y);
      doc.text(String(item.quantity || 0), itemCols[1], y);
      doc.text(`৳${Number(item.unit_price || 0).toLocaleString()}`, itemCols[2], y);
      doc.text(`৳${Number(item.total || (item.quantity * item.unit_price) || 0).toLocaleString()}`, itemCols[3], y);
      y += 8;
    });
  }

  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(100, y, pw - 15, y);
  y += 8;

  // Totals
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFontSize(bold ? 11 : 9);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(label, 120, y);
    doc.text(value, pw - 20, y, { align: "right" });
    y += bold ? 9 : 7;
  };

  const subtotal = Number(sale.subtotal || sale.total || 0);
  const discount = Number(sale.discount || 0);
  const tax = Number(sale.tax || 0);
  const total = Number(sale.total || 0);
  const paid = Number(sale.paid_amount || 0);
  const due = Number(sale.due_amount || total - paid);

  totalRow("Subtotal:", `৳${subtotal.toLocaleString()}`);
  if (discount > 0) totalRow("Discount:", `-৳${discount.toLocaleString()}`);
  if (tax > 0) totalRow("Tax:", `৳${tax.toLocaleString()}`);
  totalRow("Total:", `৳${total.toLocaleString()}`, true);
  totalRow("Paid:", `৳${paid.toLocaleString()}`);
  if (due > 0) {
    doc.setTextColor(239, 68, 68);
    totalRow("Due:", `৳${due.toLocaleString()}`, true);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated invoice. No signature required.", pw / 2, 280, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleDateString()} — Smart ISP Billing System`, pw / 2, 285, { align: "center" });

  doc.save(`invoice-${sale.invoice_number || sale.id?.substring(0, 8)}.pdf`);
}
