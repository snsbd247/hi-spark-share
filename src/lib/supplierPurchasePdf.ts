import jsPDF from "jspdf";
import { format } from "date-fns";
import { PDF_COLORS, PDF_FONT, PDF_SPACING, drawCompanyHeader, drawSectionHeader, drawFooter, fmtCurrency } from "./pdfTheme";

export function generateSupplierPurchaseInvoicePDF(purchase: any, supplier: any, items: any[], companyName = "Smart ISP") {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;

  let y = drawCompanyHeader(doc, {
    companyName,
    subtitle: "Internet Service Provider",
    docTitle: "PURCHASE INVOICE",
    docMeta: [
      purchase.purchase_no || "",
      `Date: ${purchase.date ? format(new Date(purchase.date), "dd MMM yyyy") : "-"}`,
    ],
    style: "banner",
  });

  // Supplier info
  doc.setFillColor(...PDF_COLORS.bgLight);
  doc.roundedRect(m, y - 2, pw - m * 2, 24, 2, 2, "F");
  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.text);
  doc.text("Supplier:", m + 4, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(supplier?.name || "-", m + 30, y + 4);
  if (supplier?.company) { doc.setFontSize(PDF_FONT.body); doc.text(`Company: ${supplier.company}`, m + 4, y + 11); }
  if (supplier?.phone) { doc.setFontSize(PDF_FONT.body); doc.text(`Phone: ${supplier.phone}`, m + 4, y + 17); }
  y += 28;

  // Status badge
  const status = purchase.status?.toUpperCase() || "UNPAID";
  const isPaid = purchase.status === "paid";
  doc.setFillColor(isPaid ? PDF_COLORS.success[0] : PDF_COLORS.danger[0], isPaid ? PDF_COLORS.success[1] : PDF_COLORS.danger[1], isPaid ? PDF_COLORS.success[2] : PDF_COLORS.danger[2]);
  doc.roundedRect(pw - m - 36, y - 8, 36, 10, 2, 2, "F");
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(PDF_FONT.small);
  doc.setFont("helvetica", "bold");
  doc.text(status, pw - m - 18, y - 1, { align: "center" });
  y += 8;

  // Table
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(m, y, pw - m * 2, 9, "F");
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.text("#", m + 4, y + 6);
  doc.text("Item", m + 14, y + 6);
  doc.text("Qty", pw - m - 66, y + 6, { align: "right" });
  doc.text("Unit Price", pw - m - 36, y + 6, { align: "right" });
  doc.text("Total", pw - m - 4, y + 6, { align: "right" });
  y += 12;

  doc.setTextColor(...PDF_COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONT.body);

  items.forEach((item, i) => {
    if (y > 255) { doc.addPage(); y = 20; }
    const name = item.products?.name || item.description || "Item";
    const qty = Number(item.quantity);
    const price = Number(item.unit_price);
    const total = qty * price;

    if (i % 2 === 0) { doc.setFillColor(...PDF_COLORS.bgRow); doc.rect(m, y - 4, pw - m * 2, 8, "F"); }

    doc.text(`${i + 1}`, m + 4, y);
    doc.text(name.substring(0, 40), m + 14, y);
    doc.text(`${qty}`, pw - m - 66, y, { align: "right" });
    doc.text(fmtCurrency(price), pw - m - 36, y, { align: "right" });
    doc.text(fmtCurrency(total), pw - m - 4, y, { align: "right" });
    y += 8;
  });

  y += 4;
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m, y, pw - m, y);
  y += 7;

  const total = Number(purchase.total_amount);
  const paid = Number(purchase.paid_amount);
  const due = total - paid;

  const addTotalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(PDF_FONT.heading);
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(label, pw - m - 66, y);
    doc.text(value, pw - m - 4, y, { align: "right" });
    y += 7;
  };

  addTotalRow("Subtotal", fmtCurrency(total));
  addTotalRow("Paid Amount", fmtCurrency(paid));
  if (due > 0) {
    doc.setTextColor(...PDF_COLORS.danger);
    addTotalRow("Due Amount", fmtCurrency(due), true);
  } else {
    doc.setTextColor(...PDF_COLORS.success);
    addTotalRow("Due Amount", "Tk 0.00", true);
  }

  // Grand total box
  y += 3;
  doc.setFillColor(...PDF_COLORS.navy);
  doc.roundedRect(pw / 2, y, pw / 2 - m, 14, 2, 2, "F");
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "normal");
  doc.text("Grand Total", pw / 2 + 6, y + 6);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(fmtCurrency(total), pw - m - 4, y + 10, { align: "right" });

  if (purchase.notes) {
    y += 22;
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.setFontSize(PDF_FONT.body);
    doc.setFont("helvetica", "italic");
    doc.text(`Notes: ${purchase.notes}`, m, y);
  }

  drawFooter(doc, { noteText: "This is a computer-generated invoice. No signature required." });
  doc.save(`${purchase.purchase_no || "purchase"}-invoice.pdf`);
}
