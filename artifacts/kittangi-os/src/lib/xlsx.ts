import * as XLSX from "xlsx";

/**
 * Tiny convenience wrapper around the SheetJS API. We standardize on
 * "array of arrays" (AOA) input because every report in this app is
 * essentially a header row followed by data rows — keeping the format
 * uniform makes the Excel files predictable for end-users opening them
 * in Tally / Zoho / Excel.
 */

export type Sheet = {
  name: string;
  /** First row should be the header. */
  rows: Array<Array<string | number>>;
  /** Optional column widths (width = wch units, ~character count). */
  colWidths?: number[];
};

export function exportXlsx(filename: string, sheets: Sheet[]): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.colWidths && s.colWidths.length > 0) {
      ws["!cols"] = s.colWidths.map((w) => ({ wch: w }));
    }
    // Excel sheet names are limited to 31 chars and cannot contain certain chars.
    const safeName = s.name.replace(/[\\/?*[\]]/g, " ").slice(0, 31) || "Sheet1";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  XLSX.writeFile(wb, filename);
}

/** Round to 0dp and force `Number` so Excel treats it as numeric (not text). */
export function num(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/** Format an ISO date for display in spreadsheet cells. */
export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
