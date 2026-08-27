/**
 * CSV export — plan.md §11.1: "All exportable to CSV/XLSX." `apps/api`
 * has no CSV dependency anywhere yet (checked `package.json` and the P1
 * product importer before writing this — no bulk CSV import exists in
 * this codebase either, so there was nothing to stay consistent with).
 * RFC 4180 escaping is a handful of lines, not worth a dependency for.
 *
 * XLSX is deliberately NOT implemented — it would need a new dependency
 * (`exceljs` or similar) for a format Excel/Sheets/Numbers all open a
 * plain CSV in just as well. A documented simplification per the brief's
 * own "ship CSV only... note XLSX as a documented simplification rather
 * than pulling in a new dependency without strong justification."
 */

export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => string | number | boolean | Date | null | undefined;
}

function escapeCsvCell(raw: string | number | boolean | Date | null | undefined): string {
  const str = raw === null || raw === undefined ? '' : raw instanceof Date ? raw.toISOString() : String(raw);
  // RFC 4180: a field containing a comma, quote, or newline must be
  // quoted, with any embedded quote doubled.
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** `\r\n` line endings (RFC 4180) and a leading UTF-8 BOM so Excel — the
 *  brief's own "CSV opens fine in Excel too" — renders Arabic/any non-
 *  ASCII text correctly instead of guessing the wrong codepage. */
export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const BOM = '﻿';
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(','));
  return BOM + [headerLine, ...lines].join('\r\n') + '\r\n';
}
