import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FileDown, FileSpreadsheet, Printer, Eye, Calendar } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

interface Column {
  header: string;
  key: string;
  format?: (value: any, row: any) => string;
}

interface ReportToolbarProps {
  title: string;
  data: any[];
  columns: Column[];
  fileName?: string;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (v: string) => void;
  onDateToChange?: (v: string) => void;
  showDateFilter?: boolean;
  children?: React.ReactNode;
}

function formatCell(col: Column, row: any): string {
  if (col.format) return col.format(row[col.key], row);
  const v = row[col.key];
  if (v == null) return "";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

export default function ReportToolbar({
  title, data, columns, fileName, dateFrom, dateTo,
  onDateFromChange, onDateToChange, showDateFilter = true, children,
}: ReportToolbarProps) {
  const safeFileName = fileName || title.replace(/[^a-zA-Z0-9]/g, "_");

  const generatePdf = useCallback((preview: boolean) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 16;
    const usableW = pageW - margin * 2;

    // Header
    doc.setFillColor(22, 50, 112);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, 14);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const dateStr = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : new Date().toLocaleDateString();
    doc.text(`Generated: ${dateStr}`, pageW - margin, 14, { align: "right" });

    // Table
    const colW = usableW / columns.length;
    let y = 30;
    const lineH = 6;

    // Table header
    doc.setFillColor(240, 240, 245);
    doc.rect(margin, y, usableW, lineH + 2, "F");
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    columns.forEach((col, i) => {
      doc.text(col.header, margin + i * colW + 2, y + lineH - 1);
    });
    y += lineH + 2;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(30, 30, 30);

    data.forEach((row, rowIdx) => {
      if (y > pageH - 20) {
        doc.addPage();
        y = 16;
        // Repeat header on new page
        doc.setFillColor(240, 240, 245);
        doc.rect(margin, y, usableW, lineH + 2, "F");
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        columns.forEach((col, i) => {
          doc.text(col.header, margin + i * colW + 2, y + lineH - 1);
        });
        y += lineH + 2;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
      }

      if (rowIdx % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, y, usableW, lineH, "F");
      }

      columns.forEach((col, i) => {
        const text = formatCell(col, row);
        const maxW = colW - 4;
        const truncated = doc.getTextWidth(text) > maxW
          ? text.substring(0, Math.floor(maxW / doc.getTextWidth("a"))) + ".."
          : text;
        doc.text(truncated, margin + i * colW + 2, y + lineH - 1.5);
      });
      y += lineH;
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Total Records: ${data.length}`, margin, pageH - 8);
    doc.text(`Page 1`, pageW - margin, pageH - 8, { align: "right" });

    if (preview) {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } else {
      doc.save(`${safeFileName}.pdf`);
    }
  }, [title, data, columns, dateFrom, dateTo, safeFileName]);

  const exportExcel = useCallback(() => {
    const rows = data.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        obj[col.header] = col.format ? col.format(row[col.key], row) : row[col.key];
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31));
    XLSX.writeFile(wb, `${safeFileName}.xlsx`);
  }, [data, columns, title, safeFileName]);

  const handlePrint = useCallback(() => {
    generatePdf(true);
    setTimeout(() => window.print(), 500);
  }, [generatePdf]);

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
        {/* Date Filters */}
        {showDateFilter && onDateFromChange && onDateToChange && (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> From
              </Label>
              <Input type="date" value={dateFrom || ""} onChange={(e) => onDateFromChange(e.target.value)} className="h-9 w-36 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={dateTo || ""} onChange={(e) => onDateToChange(e.target.value)} className="h-9 w-36 text-xs" />
            </div>
            {children}
          </div>
        )}
        {!showDateFilter && children && <div className="flex items-end gap-3 flex-wrap">{children}</div>}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => generatePdf(true)}>
            <Eye className="h-3.5 w-3.5" /> PDF Preview
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => generatePdf(false)}>
            <FileDown className="h-3.5 w-3.5" /> Download PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={exportExcel}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
