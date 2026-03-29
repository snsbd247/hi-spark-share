import jsPDF from "jspdf";

interface Settings {
  site_name: string;
  address?: string | null;
  email?: string | null;
  mobile?: string | null;
  logo_url?: string | null;
}

export async function generateApplicationFormPDF(customer: any, pkg: any, settings: Settings, photoDataUrl?: string | null) {
  let photoData = photoDataUrl;
  if (!photoData && customer.photo_url) {
    try {
      const response = await fetch(customer.photo_url);
      const blob = await response.blob();
      photoData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* skip photo if fetch fails */ }
  }

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 12; // margin
  const cw = pw - m * 2;
  let y = 0;

  // Colors
  const navy: [number, number, number] = [25, 55, 109];
  const lightBg: [number, number, number] = [244, 246, 249];
  const border: [number, number, number] = [210, 210, 210];
  const textDark: [number, number, number] = [30, 30, 30];
  const textMuted: [number, number, number] = [120, 120, 120];

  // ─── HEADER (compact) ───
  doc.setFillColor(...navy);
  doc.rect(0, 0, pw, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(settings.site_name || "Smart ISP", m, 12);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const headerParts = [];
  if (settings.mobile) headerParts.push(`Hotline: ${settings.mobile}`);
  if (settings.email) headerParts.push(settings.email);
  doc.text(headerParts.join("  |  "), m, 18);
  if (settings.address) doc.text(settings.address, m, 23);

  // Right side
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("APPLICATION FORM", pw - m, 11, { align: "right" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`ID: ${customer.customer_id || "—"}  |  Date: ${new Date().toLocaleDateString("en-GB")}`, pw - m, 18, { align: "right" });

  y = 32;

  // ─── HELPERS ───
  const sectionTitle = (title: string) => {
    doc.setFillColor(...navy);
    doc.rect(m, y, cw, 5.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), m + 3, y + 4);
    y += 7;
    doc.setTextColor(...textDark);
  };

  const field = (label: string, value: string, x: number, w: number, h = 8) => {
    doc.setDrawColor(...border);
    doc.rect(x, y, w, h, "S");
    // Label bg
    doc.setFillColor(...lightBg);
    doc.rect(x, y, w, 3.2, "F");
    doc.setFontSize(5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textMuted);
    doc.text(label, x + 1.5, y + 2.5);
    // Value
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textDark);
    const truncated = value.length > Math.floor(w / 1.8) ? value.substring(0, Math.floor(w / 1.8)) + "…" : value;
    doc.text(truncated || "—", x + 1.5, y + 6.5);
  };

  const row = (fields: { label: string; value: string }[], h = 8) => {
    const fw = cw / fields.length;
    fields.forEach((f, i) => field(f.label, f.value, m + fw * i, fw, h));
    y += h + 0.5;
  };

  // ─── CUSTOMER INFORMATION ───
  sectionTitle("Customer Information");

  // Photo area (right side)
  const photoSize = 20;
  const photoX = pw - m - photoSize;
  const photoY = y;
  doc.setDrawColor(...border);
  doc.rect(photoX, photoY, photoSize, photoSize, "S");
  if (photoData) {
    try { doc.addImage(photoData, "JPEG", photoX + 0.5, photoY + 0.5, photoSize - 1, photoSize - 1); } catch {}
  } else {
    doc.setFontSize(5.5);
    doc.setTextColor(...textMuted);
    doc.text("PHOTO", photoX + photoSize / 2, photoY + photoSize / 2, { align: "center" });
    doc.setTextColor(...textDark);
  }

  const infoW = cw - photoSize - 2;
  const fw2 = infoW / 2;
  const fw3 = infoW / 3;

  // Row 1
  field("Applicant Name", customer.name || "", m, fw2);
  field("Father Name", customer.father_name || "", m + fw2, fw2);
  y += 8.5;

  // Row 2
  field("Customer ID", customer.customer_id || "", m, fw3);
  field("NID", customer.nid || "", m + fw3, fw3);
  field("Mother Name", customer.mother_name || "", m + fw3 * 2, fw3);
  y += 8.5;

  y = Math.max(y, photoY + photoSize + 1);

  row([
    { label: "Mobile", value: customer.phone || "" },
    { label: "Alt Contact", value: customer.alt_phone || "" },
    { label: "Email", value: customer.email || "" },
    { label: "Occupation", value: customer.occupation || "" },
  ]);

  y += 1.5;

  // ─── ADDRESS ───
  sectionTitle("Address Information");

  row([
    { label: "Zone / Area", value: customer.area || "" },
    { label: "Road", value: customer.road || "" },
    { label: "House", value: customer.house || "" },
    { label: "City", value: customer.city || "" },
  ]);

  row([
    { label: "Village", value: customer.village || "" },
    { label: "Post Office", value: customer.post_office || "" },
    { label: "District", value: customer.district || "" },
  ]);

  field("Permanent Address", customer.permanent_address || "", m, cw, 8);
  y += 8.5;

  y += 1.5;

  // ─── CONNECTION DETAILS ───
  sectionTitle("Connection Details");

  row([
    { label: "Package", value: pkg?.name || "" },
    { label: "Speed", value: pkg?.speed || "" },
    { label: "Bandwidth", value: "Shared" },
  ]);

  row([
    { label: "PPPoE Username", value: customer.pppoe_username || "" },
    { label: "PPPoE Password", value: customer.pppoe_password || "" },
    { label: "IP Address", value: customer.ip_address || "" },
  ]);

  row([
    { label: "Gateway", value: customer.gateway || "" },
    { label: "Subnet", value: customer.subnet || "" },
    { label: "ONU MAC", value: customer.onu_mac || "" },
    { label: "Router MAC", value: customer.router_mac || "" },
  ]);

  y += 1.5;

  // ─── BILLING ───
  sectionTitle("Billing Information");

  const monthlyBill = Number(customer.monthly_bill || 0);
  const discount = Number(customer.discount || 0);
  const total = monthlyBill - discount;

  row([
    { label: "Connection Date", value: customer.installation_date || "" },
    { label: "Monthly Bill", value: `৳${monthlyBill.toLocaleString()}` },
    { label: "Discount", value: `৳${discount.toLocaleString()}` },
    { label: "Net Amount", value: `৳${total.toLocaleString()}` },
    { label: "Due Date", value: customer.due_date_day ? `${customer.due_date_day}th` : "—" },
  ]);

  y += 1.5;

  // ─── OFFICE USE ───
  sectionTitle("Office Use Only");

  row([
    { label: "POP Location", value: customer.pop_location || "" },
    { label: "Installed By", value: customer.installed_by || "" },
    { label: "Box Name", value: customer.box_name || "" },
    { label: "Cable Length", value: customer.cable_length || "" },
  ]);

  y += 6;

  // ─── SIGNATURES ───
  const sigW = (cw - 10) / 3;
  doc.setDrawColor(...border);
  [
    { label: "Applicant Signature", x: m },
    { label: "Admin Signature", x: m + sigW + 5 },
    { label: "Marketing Signature", x: m + (sigW + 5) * 2 },
  ].forEach(({ label, x }) => {
    doc.line(x, y + 10, x + sigW, y + 10);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text(label, x + sigW / 2, y + 14, { align: "center" });
  });

  y += 20;

  // ─── TERMS ───
  doc.setFontSize(5.5);
  doc.setTextColor(...textMuted);
  doc.text("I hereby declare that all the information provided above is correct to the best of my knowledge.", m, y);
  doc.text("The ISP reserves the right to suspend the connection in case of non-payment or violation of terms.", m, y + 3.5);

  // ─── FOOTER ───
  doc.setFontSize(5.5);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} — ${settings.site_name || "Smart ISP"} Billing System`,
    pw / 2, ph - 5, { align: "center" }
  );

  return doc;
}
