import jsPDF from "jspdf";
import {
  PDF_COLORS, PDF_FONT, PDF_SPACING,
  drawCompanyHeader, drawSectionHeader, drawFooter, fmtCurrency,
} from "./pdfTheme";
import { safeFormat } from "@/lib/utils";

interface PaySlipOptions {
  employee: { employee_id: string; name: string; phone?: string; email?: string };
  sheet: any;
  companyName: string;
  companyAddress?: string;
}

export function generatePaySlipPdf({ employee, sheet, companyName, companyAddress }: PaySlipOptions) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = PDF_SPACING.margin;
  const cw = pw - m * 2;

  // ─── Header ───
  let y = drawCompanyHeader(doc, {
    companyName,
    subtitle: companyAddress || "",
    docTitle: "PAY SLIP",
    docMeta: [`Month: ${sheet.month}`],
    style: "banner",
  });

  // ─── Employee Info ───
  y = drawSectionHeader(doc, "Employee Information", y);

  const infoRows = [
    [{ l: "Employee ID", v: employee.employee_id }, { l: "Name", v: employee.name }],
    [{ l: "Phone", v: employee.phone || "—" }, { l: "Email", v: employee.email || "—" }],
  ];

  doc.setFontSize(PDF_FONT.body);
  infoRows.forEach((row) => {
    row.forEach((item, i) => {
      const x = m + (cw / 2) * i;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_COLORS.textMuted);
      doc.text(item.l + ":", x, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_COLORS.text);
      doc.text(item.v, x + 30, y);
    });
    y += 7;
  });

  y += 4;

  // ─── Earnings ───
  y = drawSectionHeader(doc, "Earnings", y);

  const earnings = [
    ["Basic Salary", Number(sheet.basic_salary)],
    ["House Rent", Number(sheet.house_rent || 0)],
    ["Medical Allowance", Number(sheet.medical || 0)],
    ["Conveyance", Number(sheet.conveyance || 0)],
    ["Other Allowance", Number(sheet.other_allowance || 0)],
    ["Bonus", Number(sheet.bonus)],
  ] as [string, number][];

  earnings.forEach(([label, amount]) => {
    if (amount > 0) {
      doc.setFontSize(PDF_FONT.body);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_COLORS.text);
      doc.text(label, m + 4, y);
      doc.text(fmtCurrency(amount), pw - m, y, { align: "right" });
      y += PDF_SPACING.rowHeight;
    }
  });

  const grossTotal = earnings.reduce((s, [, a]) => s + a, 0);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m, y, pw - m, y);
  y += 5;
  doc.setFontSize(PDF_FONT.heading);
  doc.setFont("helvetica", "bold");
  doc.text("Gross Salary", m + 4, y);
  doc.text(fmtCurrency(grossTotal), pw - m, y, { align: "right" });
  y += 10;

  // ─── Deductions ───
  y = drawSectionHeader(doc, "Deductions", y);

  const deductions = [
    ["Loan Deduction", Number(sheet.loan_deduction)],
    ["Other Deduction", Number(sheet.deduction)],
  ] as [string, number][];

  deductions.forEach(([label, amount]) => {
    if (amount > 0) {
      doc.setFontSize(PDF_FONT.body);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_COLORS.text);
      doc.text(label, m + 4, y);
      doc.text(fmtCurrency(amount), pw - m, y, { align: "right" });
      y += PDF_SPACING.rowHeight;
    }
  });

  const totalDeductions = deductions.reduce((s, [, a]) => s + a, 0);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(m, y, pw - m, y);
  y += 5;
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "bold");
  doc.text("Total Deductions", m + 4, y);
  doc.text(fmtCurrency(totalDeductions), pw - m, y, { align: "right" });
  y += 12;

  // ─── Net Pay ───
  doc.setFillColor(...PDF_COLORS.bgLight);
  doc.rect(m, y - 4, cw, 12, "F");
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(0.5);
  doc.rect(m, y - 4, cw, 12, "S");

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text("Net Pay", m + 6, y + 4);
  doc.text(`BDT ${fmtCurrency(Number(sheet.net_salary))}`, pw - m - 4, y + 4, { align: "right" });
  y += 16;

  // ─── Status ───
  doc.setFontSize(PDF_FONT.body);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text("Status: " + (sheet.status || "").toUpperCase(), m, y);
  if (sheet.paid_date) doc.text("Paid Date: " + safeFormat(sheet.paid_date, "dd MMM yyyy"), pw / 2, y);
  y += 20;

  // ─── Signatures ───
  const sigW = (cw - 20) / 2;
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(m, y, m + sigW, y);
  doc.line(pw - m - sigW, y, pw - m, y);
  y += 5;
  doc.setFontSize(PDF_FONT.small);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text("Employee Signature", m + sigW / 2, y, { align: "center" });
  doc.text("Authorized Signature", pw - m - sigW / 2, y, { align: "center" });

  // ─── Footer ───
  drawFooter(doc, { companyAddress });

  doc.save(`PaySlip-${employee.employee_id}-${sheet.month}.pdf`);
}
