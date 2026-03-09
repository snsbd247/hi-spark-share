import jsPDF from "jspdf";

interface Settings {
  site_name: string;
  address?: string | null;
  email?: string | null;
  mobile?: string | null;
  logo_url?: string | null;
}

export async function generateApplicationFormPDF(customer: any, pkg: any, settings: Settings, photoDataUrl?: string | null) {
  // If customer has photo_url but no dataUrl passed, try to fetch it
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
  const margin = 15;
  const contentW = pw - margin * 2;
  let y = 0;

  // Colors
  const navy = [20, 50, 120] as const;
  const lightBg = [245, 247, 250] as const;
  const borderGray = [200, 200, 200] as const;

  // ─── HEADER ───
  doc.setFillColor(...navy);
  doc.rect(0, 0, pw, 38, "F");

  // Logo placeholder
  doc.setFillColor(255, 255, 255);
  doc.circle(28, 19, 10, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text("ISP", 23, 22);

  // ISP Name & tagline
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(settings.site_name || "Smart ISP", 45, 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Internet Service Provider", 45, 22);
  if (settings.mobile) doc.text(`Hotline: ${settings.mobile}`, 45, 28);
  if (settings.address) doc.text(settings.address, 45, 34);

  // Form badge
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("APPLICATION FORM", pw - 20, 14, { align: "right" });
  doc.setDrawColor(255, 255, 255);
  doc.roundedRect(pw - 62, 6, 48, 12, 2, 2, "S");

  // Form number & customer ID
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

  // Photo box on right side
  const photoSize = 28;
  const photoX = pw - margin - photoSize;
  const photoY = y;
  doc.setDrawColor(...borderGray);
  doc.rect(photoX, photoY, photoSize, photoSize, "S");
  if (photoData) {
    try {
      doc.addImage(photoData, "JPEG", photoX + 1, photoY + 1, photoSize - 2, photoSize - 2);
    } catch { /* skip if image fails */ }
  } else {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("PHOTO", photoX + photoSize / 2, photoY + photoSize / 2, { align: "center" });
    doc.setTextColor(20, 20, 20);
  }

  const infoW = contentW - photoSize - 4;
  // Row 1
  fieldBox("Applicant Name", customer.name || "", margin, infoW / 2);
  fieldBox("Father Name", customer.father_name || "", margin + infoW / 2, infoW / 2);
  y += 11;

  // Row 2
  fieldBox("Customer ID", customer.customer_id || "", margin, infoW / 3);
  fieldBox("National ID", customer.nid || "", margin + infoW / 3, infoW / 3);
  fieldBox("Email", customer.email || "", margin + (infoW / 3) * 2, infoW / 3);
  y += 11;

  // Row 3 - after photo area
  y = Math.max(y, photoY + photoSize + 2);
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

  fieldRow([
    { label: "Flat No", value: "" },
    { label: "Floor No", value: "" },
    { label: "Land Owner Name", value: "" },
  ]);

  fieldBox("Permanent Address", "", margin, contentW, 12);
  y += 13;

  fieldRow([
    { label: "Village", value: "" },
    { label: "Post Office", value: "" },
    { label: "District", value: "" },
  ]);

  y += 3;

  // ─── CONNECTION DETAILS ───
  sectionHeader("Connection Details");

  fieldRow([
    { label: "Bandwidth Type", value: "Shared" },
    { label: "Package Name", value: pkg?.name || "" },
    { label: "Speed", value: pkg?.speed || "" },
  ]);

  fieldRow([
    { label: "PPPoE Username", value: customer.pppoe_username || "" },
    { label: "PPPoE Password", value: customer.pppoe_password || "" },
  ]);

  fieldRow([
    { label: "IP Address", value: customer.ip_address || "" },
    { label: "ONU MAC", value: customer.onu_mac || "" },
    { label: "Router MAC", value: customer.router_mac || "" },
  ]);

  y += 3;

  // ─── BILLING INFORMATION ───
  sectionHeader("Billing Information");

  fieldRow([
    { label: "Connection Date", value: customer.installation_date || "" },
    { label: "Monthly Bill", value: `${Number(customer.monthly_bill || 0).toLocaleString()} BDT` },
    { label: "Due Date (Day)", value: customer.due_date_day ? `${customer.due_date_day}th of every month` : "—" },
  ]);

  fieldRow([
    { label: "Connectivity Fee", value: "" },
    { label: "Discount", value: "" },
    { label: "Total Amount", value: `${Number(customer.monthly_bill || 0).toLocaleString()} BDT` },
  ]);

  y += 3;

  // ─── OFFICE USE ───
  sectionHeader("Office Use Only");

  fieldRow([
    { label: "POP Location", value: "" },
    { label: "Installed By", value: "" },
    { label: "Box Name", value: "" },
    { label: "Cable Length", value: "" },
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
    `Generated on ${new Date().toLocaleDateString()} — ${settings.site_name || "Smart ISP"} Billing System`,
    pw / 2, 288, { align: "center" }
  );

  return doc;
}
