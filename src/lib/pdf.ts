import jsPDF from "jspdf";

export function generatePaymentReceiptPDF(payment: any, customer: any) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 45, "F");

  // ISP Logo placeholder (circle)
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
  doc.text("Payment Receipt", 50, 36);

  // Receipt badge
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PAID", pageWidth - 35, 20);
  doc.setDrawColor(255, 255, 255);
  doc.roundedRect(pageWidth - 45, 12, 30, 12, 3, 3, "S");

  // Receipt number
  const receiptNo = `RCP-${payment.id?.substring(0, 8).toUpperCase() || "00000000"}`;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(receiptNo, pageWidth - 20, 36, { align: "right" });

  // Reset text color
  doc.setTextColor(30, 30, 30);
  let y = 60;

  // Section helper
  const sectionTitle = (title: string) => {
    doc.setFillColor(240, 244, 248);
    doc.rect(15, y - 5, pageWidth - 30, 8, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text(title, 20, y);
    doc.setTextColor(30, 30, 30);
    y += 12;
  };

  const fieldRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(label, 25, y);
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", 90, y);
    y += 8;
  };

  // Customer Info
  sectionTitle("Customer Information");
  fieldRow("Customer Name", customer?.name || "—");
  fieldRow("Customer ID", customer?.customer_id || "—");
  fieldRow("Phone", customer?.phone || "—");
  y += 5;

  // Payment Info
  sectionTitle("Payment Details");
  fieldRow("Bill Month", payment.month || "—");
  fieldRow("Amount Paid", `৳${Number(payment.amount).toLocaleString()} BDT`);
  fieldRow("Payment Method", (payment.payment_method || "—").toUpperCase());
  fieldRow("Transaction ID", payment.transaction_id || payment.bkash_trx_id || "—");
  fieldRow("Payment Date", payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—");
  fieldRow("Status", "PAID");
  y += 10;

  // Amount box
  doc.setFillColor(240, 249, 244);
  doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, "F");
  doc.setDrawColor(34, 197, 94);
  doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, "S");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 60);
  doc.text("Total Paid:", 25, y + 15);
  doc.setFontSize(18);
  doc.text(`৳${Number(payment.amount).toLocaleString()} BDT`, pageWidth - 25, y + 15, { align: "right" });
  y += 35;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Thank you message
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text("Thank you for your payment. This is a computer-generated receipt.", pageWidth / 2, y, { align: "center" });
  doc.text("No signature required.", pageWidth / 2, y + 6, { align: "center" });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} — Smart ISP Billing System`,
    pageWidth / 2,
    285,
    { align: "center" }
  );

  doc.save(`receipt-${receiptNo}.pdf`);
}

export function generateCustomerPDF(customer: any) {
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
  const connectivityFee = Number(customer.connectivity_fee || 0);
  const totalAmount = monthlyBill - discount + connectivityFee;

  fieldRow([
    { label: "Connection Date", value: customer.installation_date || "" },
    { label: "Monthly Bill", value: `${monthlyBill.toLocaleString()} BDT` },
    { label: "Due Date (Day)", value: customer.due_date_day ? `${customer.due_date_day}th of every month` : "—" },
  ]);

  fieldRow([
    { label: "Connectivity Fee", value: `${connectivityFee.toLocaleString()} BDT` },
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

  // Check if we need a new page for signatures
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

  // ─── TERMS ───
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("I hereby declare that all the information provided above is correct to the best of my knowledge.", margin, y);
  doc.text("The ISP reserves the right to suspend the connection in case of non-payment or violation of terms.", margin, y + 4);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} — Smart ISP Billing System`,
    pw / 2, 288, { align: "center" }
  );

  doc.save(`${customer.customer_id || "customer"}-application-form.pdf`);
}
