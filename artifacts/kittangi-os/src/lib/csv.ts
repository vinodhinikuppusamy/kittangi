export type CsvColumn<T> = {
  header: string;
  key: keyof T | ((row: T) => string | number);
  format?: (value: unknown, row: T) => string | number;
};

function escape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escape(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw =
            typeof c.key === "function"
              ? c.key(row)
              : (row[c.key] as unknown);
          const v = c.format ? c.format(raw, row) : raw;
          return escape(v);
        })
        .join(","),
    )
    .join("\r\n");
  return body.length > 0 ? `${header}\r\n${body}` : header;
}

export function downloadCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
): void {
  const csv = buildCsv(columns, rows);
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
