import jsPDF from "jspdf";
import { PDF_COLORS, PDF_FONT, fmtCurrency } from "./pdfTheme";

interface LedgerRow {
  sn: number;
  date: string;
  type: string;
  reference: string;
  description: string;
  note: string;
  debit: number;
  credit: number;
  running_balance: number;
}

interface LedgerPdfOptions {
  accountName: string;
  accountCode: string;
  accountType: string;
  dateFrom: string;
  dateTo: string;
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  companyName?: string;
}

const fmt = (v: number) =>
  Math.abs(v).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateLedgerStatementPdf(opts: LedgerPdfOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 6;
  const mR = 6;
  const tableW = pageW - mL - mR;

  const cols = [
    { label: "SN", w: 10, align: "center" as const },
    { label: "Vch. Date", w: 22, align: "left" as const },
    { label: "Vch Type", w: 20, align: "left" as const },
    { label: "Vch No", w: 28, align: "left" as const },
    { label: "Ref No", w: 28, align: "left" as const },
    { label: "Particulars", w: 55, align: "left" as const },
    { label: "Note", w: 38, align: "left" as const },
    { label: "Cost Centre", w: 22, align: "left" as const },
    { label: "Qty", w: 14, align: "right" as const },
    { label: "Debit", w: 24, align: "right" as const },
    { label: "Credit", w: 24, align: "right" as const },
    { label: "Balance", w: 26, align: "right" as const },
  ];

  const totalColW = cols.reduce((s, c) => s + c.w, 0);
  const scale = tableW / totalColW;
  cols.forEach((c) => (c.w *= scale));

  const navy = PDF_COLORS.navy;
  const rowH = 5.5;
  const headerH = 6.5;
  let curY = 8;
  let pageNum = 1;

  function drawPageHeader() {
    const company = opts.companyName || "Company Name";

    // Navy banner
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(company, mL + 4, 10);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const subtitle = `Statement of ${opts.accountCode ? opts.accountCode + " - " : ""}${opts.accountName}`;
    doc.text(subtitle, mL + 4, 16);

    doc.setFontSize(8);
    doc.text(`Period: ${opts.dateFrom}  to  ${opts.dateTo}`, mL + 4, 22);

    // Summary box (top-right, on banner)
    const sumX = pageW - mR - 70;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", sumX + 34, 8, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Total Credit: ${fmt(opts.totalCredit)}`, sumX + 66, 13, { align: "right" });
    doc.text(`Total Debit: ${fmt(opts.totalDebit)}`, sumX + 66, 17.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(`Cur. Balance: ${fmt(opts.closingBalance)}`, sumX + 66, 22, { align: "right" });

    doc.setTextColor(...PDF_COLORS.text);
    curY = 30;
  }

  function drawTableHeader() {
    doc.setFillColor(...PDF_COLORS.bgLight);
    doc.rect(mL, curY, tableW, headerH, "F");
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.3);
    doc.rect(mL, curY, tableW, headerH);

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.text);

    let x = mL;
    cols.forEach((col) => {
      const tx = col.align === "center" ? x + col.w / 2 : col.align === "right" ? x + col.w - 2 : x + 1.5;
      doc.text(col.label, tx, curY + headerH / 2, { align: col.align, baseline: "middle" });
      doc.line(x, curY, x, curY + headerH);
      x += col.w;
    });
    doc.line(x, curY, x, curY + headerH);
    curY += headerH;
  }

  function drawOpeningBalanceRow() {
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.15);
    doc.rect(mL, curY, tableW, rowH);

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...PDF_COLORS.textMuted);

    let x = mL;
    for (let i = 0; i < 5; i++) x += cols[i].w;
    doc.text("Opening Balance", x + 1.5, curY + rowH / 2, { baseline: "middle" });

    const balX = mL + cols.reduce((s, c) => s + c.w, 0) - cols[11].w;
    doc.setFont("helvetica", "bold");
    doc.text("0.00", balX + cols[11].w - 2, curY + rowH / 2, { align: "right", baseline: "middle" });

    let vx = mL;
    cols.forEach((col) => { doc.line(vx, curY, vx, curY + rowH); vx += col.w; });
    doc.line(vx, curY, vx, curY + rowH);
    curY += rowH;
  }

  function drawRow(row: LedgerRow) {
    if (curY + rowH > pageH - 12) {
      drawPageFooter();
      doc.addPage();
      pageNum++;
      curY = 8;
      drawTableHeader();
    }

    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.15);

    if (row.sn % 2 === 0) {
      doc.setFillColor(...PDF_COLORS.bgRow);
      doc.rect(mL, curY, tableW, rowH, "F");
    }
    doc.rect(mL, curY, tableW, rowH);

    const cellValues = [
      row.sn.toString(), row.date, row.type, "", row.reference,
      row.description, row.note, "", "0.00",
      row.debit > 0 ? fmt(row.debit) : "0.00",
      row.credit > 0 ? fmt(row.credit) : "0.00",
      fmt(row.running_balance),
    ];

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.text);

    let x = mL;
    cols.forEach((col, i) => {
      doc.line(x, curY, x, curY + rowH);
      const tx = col.align === "center" ? x + col.w / 2 : col.align === "right" ? x + col.w - 2 : x + 1.5;
      let text = cellValues[i];
      const maxW = col.w - 3;
      while (doc.getTextWidth(text) > maxW && text.length > 3) text = text.slice(0, -4) + "..";
      doc.text(text, tx, curY + rowH / 2, { align: col.align, baseline: "middle" });
      x += col.w;
    });
    doc.line(x, curY, x, curY + rowH);
    curY += rowH;
  }

  function drawNoteRow(noteText: string) {
    if (curY + rowH > pageH - 12) {
      drawPageFooter(); doc.addPage(); pageNum++; curY = 8; drawTableHeader();
    }
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.15);
    doc.rect(mL, curY, tableW, rowH);
    doc.setFontSize(6);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text("      " + noteText, mL + 2, curY + rowH / 2, { baseline: "middle" });
    let vx = mL;
    cols.forEach((col) => { doc.line(vx, curY, vx, curY + rowH); vx += col.w; });
    doc.line(vx, curY, vx, curY + rowH);
    curY += rowH;
  }

  function drawTotalRow() {
    const h = headerH + 1;
    doc.setFillColor(...navy);
    doc.rect(mL, curY, tableW, h, "F");
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.4);
    doc.rect(mL, curY, tableW, h);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    doc.text("Total", mL + 4, curY + h / 2, { baseline: "middle" });

    const debitX = mL + cols.slice(0, 9).reduce((s, c) => s + c.w, 0);
    doc.text(fmt(opts.totalDebit), debitX + cols[9].w - 2, curY + h / 2, { align: "right", baseline: "middle" });

    const creditX = debitX + cols[9].w;
    doc.text(fmt(opts.totalCredit), creditX + cols[10].w - 2, curY + h / 2, { align: "right", baseline: "middle" });

    const balX = creditX + cols[10].w;
    doc.text(fmt(opts.closingBalance), balX + cols[11].w - 2, curY + h / 2, { align: "right", baseline: "middle" });

    let vx = mL;
    cols.forEach((col) => { doc.line(vx, curY, vx, curY + h); vx += col.w; });
    doc.line(vx, curY, vx, curY + h);
    curY += h + 2;
  }

  function drawPageFooter() {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.textLight);
    doc.text(`Page ${pageNum}`, pageW / 2, pageH - 5, { align: "center" });
  }

  // BUILD
  drawPageHeader();
  drawTableHeader();
  drawOpeningBalanceRow();
  opts.rows.forEach((row) => { drawRow(row); if (row.note) drawNoteRow(row.note); });
  if (opts.rows.length > 0) drawTotalRow();
  drawPageFooter();

  const accountSlug = opts.accountName.replace(/\s+/g, "-").toLowerCase();
  doc.save(`ledger-statement-${accountSlug}.pdf`);
}
