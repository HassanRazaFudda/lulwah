/**
 * Client-side CSV export — plan.md §11.1's Orders row ("Bulk: status
 * change, print packing slips, export CSV, tag") and §11.2 rule 5 ("bulk
 * actions always state the exact consequence"). Built from data the page
 * already has in memory (the current filtered/sorted `AdminOrder[]`), no
 * new backend endpoint — `GET /admin/orders` already returns everything a
 * CSV row below needs. Only export is built in this pass; bulk status
 * change / packing slips / tagging are left as a documented gap (see the
 * Orders list page's own doc comment and this task's report).
 */

/** RFC 4180 quoting: wrap in quotes and double up any embedded quote
 *  whenever a cell contains a comma, quote, or newline — the three
 *  characters that would otherwise break column alignment or truncate a
 *  cell in Excel/Sheets. */
function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/** Triggers a browser download of `content` as `filename` via a throwaway
 *  Blob URL — no server round trip, matching "client-side, from data you
 *  already have" for this feature. */
export function downloadCsvFile(filename: string, content: string): void {
  // A UTF-8 BOM keeps Excel from mis-decoding AED amounts/Arabic customer
  // names as the system codepage instead of UTF-8.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
