import jsPDF from "jspdf";
import { format } from "date-fns";

export function generateBillInvoicePDF(bill: any, customer: any) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Logo placeholder
  doc.setFillColor(255, 255, 255);
  doc.circle(30, 22, 12, "F");
  doc.setFillColor(30, 58, 138);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("ISP", 24, 26);

  // ISP Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Smart ISP", 50, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Internet Service Provider", 50, 28);
  doc.setFontSize(9);
  doc.text("Monthly Bill Invoice", 50, 36);

  // Invoice number
  const invoiceNo = `INV-${bill.id?.substring(0, 8).toUpperCase() || "00000000"}`;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  if (bill.status === "paid") {
    doc.text("PAID", pageWidth - 35, 20);
    doc.setDrawColor(255, 255, 255);
    doc.roundedRect(pageWidth - 45, 12, 30, 12, 3, 3, "S");
  } else {
    doc.text("DUE", pageWidth - 33, 20);
    doc.setDrawColor(255, 100, 100);
    doc.roundedRect(pageWidth - 42, 12, 26, 12, 3, 3, "S");
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(invoiceNo, pageWidth - 20, 36, { align: "right" });

  doc.setTextColor(30, 30, 30);
  let y = 58;

  // Section helper
  const sectionTitle = (title: string) => {
    doc.setFillColor(240, 244, 248);
    doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text(title, 18, y + 1);
    doc.setTextColor(30, 30, 30);
    y += 12;
  };

  const addRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(label, 20, y);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth - 20, y, { align: "right" });
    y += 7;
  };

  // Customer Information
  sectionTitle("Customer Information");
  addRow("Customer ID", customer?.customer_id || "-");
  addRow("Customer Name", customer?.name || "-");
  addRow("Phone", customer?.phone || "-");
  addRow("Area", customer?.area || "-");

  y += 5;

  // Bill Details
  sectionTitle("Bill Details");
  addRow("Bill Month", bill.month || "-");
  addRow("Bill Amount", `Tk ${Number(bill.amount).toLocaleString()}`);
  addRow("Due Date", bill.due_date ? format(new Date(bill.due_date), "dd MMM yyyy") : "-");
  addRow("Status", bill.status?.toUpperCase() || "UNPAID");
  if (bill.paid_date) {
    addRow("Paid Date", format(new Date(bill.paid_date), "dd MMM yyyy"));
  }

  y += 10;

  // Total box
  doc.setFillColor(30, 58, 138);
  doc.roundedRect(14, y, pageWidth - 28, 22, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Total Amount Due", 22, y + 10);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Tk ${Number(bill.amount).toLocaleString()}`, pageWidth - 22, y + 14, { align: "right" });

  y += 35;

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("This is a computer-generated invoice. No signature required.", pageWidth / 2, y, { align: "center" });
  doc.text(`Generated on: ${format(new Date(), "dd MMM yyyy, hh:mm a")}`, pageWidth / 2, y + 6, { align: "center" });

  // Save
  const fileName = `Bill-${bill.month}-${customer?.customer_id || bill.id.substring(0, 8)}.pdf`;
  doc.save(fileName);
}
