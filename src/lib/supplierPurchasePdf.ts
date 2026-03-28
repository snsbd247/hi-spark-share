import jsPDF from "jspdf";
import { format } from "date-fns";

export function generateSupplierPurchaseInvoicePDF(purchase: any, supplier: any, items: any[]) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const navy = [20, 50, 120] as const;

  // Header
  doc.setFillColor(...navy);
  doc.rect(0, 0, pw, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Purchase Invoice", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Smart ISP", pw - 14, 16, { align: "right" });
  doc.text("Internet Service Provider", pw - 14, 23, { align: "right" });

  // Invoice number & date
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(purchase.purchase_no || "", 14, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dateStr = purchase.date ? format(new Date(purchase.date), "dd MMM yyyy") : "";
  doc.text(`Date: ${dateStr}`, pw - 14, 34, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 55;

  // Supplier info
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, y - 5, pw - 28, 28, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Supplier:", 18, y + 2);
  doc.setFont("helvetica", "normal");
  doc.text(supplier?.name || "—", 50, y + 2);
  if (supplier?.company) { doc.text(`Company: ${supplier.company}`, 18, y + 9); }
  if (supplier?.phone) { doc.text(`Phone: ${supplier.phone}`, 18, y + 16); }

  y += 32;

  // Status badge
  const status = purchase.status?.toUpperCase() || "UNPAID";
  const isPaid = purchase.status === "paid";
  doc.setFillColor(isPaid ? 34 : 239, isPaid ? 197 : 68, isPaid ? 94 : 68);
  doc.roundedRect(pw - 50, y - 6, 36, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(status, pw - 32, y + 1, { align: "center" });
  doc.setTextColor(0, 0, 0);

  y += 12;

  // Table header
  doc.setFillColor(...navy);
  doc.rect(14, y, pw - 28, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("#", 18, y + 6);
  doc.text("Item", 28, y + 6);
  doc.text("Qty", pw - 80, y + 6, { align: "right" });
  doc.text("Unit Price", pw - 50, y + 6, { align: "right" });
  doc.text("Total", pw - 18, y + 6, { align: "right" });
  y += 13;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  items.forEach((item, i) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    const name = item.products?.name || item.description || "Item";
    const qty = Number(item.quantity);
    const price = Number(item.unit_price);
    const total = qty * price;

    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(14, y - 4, pw - 28, 8, "F");
    }

    doc.text(`${i + 1}`, 18, y);
    doc.text(name.substring(0, 40), 28, y);
    doc.text(`${qty}`, pw - 80, y, { align: "right" });
    doc.text(`৳${price.toLocaleString()}`, pw - 50, y, { align: "right" });
    doc.text(`৳${total.toLocaleString()}`, pw - 18, y, { align: "right" });
    y += 8;
  });

  y += 5;
  doc.line(14, y, pw - 14, y);
  y += 8;

  // Totals
  const total = Number(purchase.total_amount);
  const paid = Number(purchase.paid_amount);
  const due = total - paid;

  const addTotalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.text(label, pw - 80, y);
    doc.text(value, pw - 18, y, { align: "right" });
    y += 7;
  };

  addTotalRow("Subtotal", `৳${total.toLocaleString()}`);
  addTotalRow("Paid Amount", `৳${paid.toLocaleString()}`);
  
  if (due > 0) {
    doc.setTextColor(239, 68, 68);
    addTotalRow("Due Amount", `৳${due.toLocaleString()}`, true);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.setTextColor(34, 197, 94);
    addTotalRow("Due Amount", "৳0", true);
    doc.setTextColor(0, 0, 0);
  }

  // Grand total box
  y += 3;
  doc.setFillColor(...navy);
  doc.roundedRect(pw / 2, y, pw / 2 - 14, 16, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Grand Total", pw / 2 + 6, y + 7);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`৳${total.toLocaleString()}`, pw - 18, y + 11, { align: "right" });

  // Notes
  if (purchase.notes) {
    y += 25;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(`Notes: ${purchase.notes}`, 14, y);
  }

  // Footer
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("This is a computer-generated invoice. No signature required.", pw / 2, y, { align: "center" });
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, pw / 2, y + 5, { align: "center" });

  doc.save(`${purchase.purchase_no || "purchase"}-invoice.pdf`);
}
