/**
 * Bulk code generation — plan.md §11.1: "Bulk generate unique codes (e.g.
 * 500 codes for an influencer campaign) with CSV export."
 *
 * There is no bulk-create endpoint on the API (`apps/api/src/modules/
 * pricing/pricing.routes.ts` only has single-discount `POST
 * /admin/discounts` — confirmed by reading the routes file, not assumed).
 * This is implemented as N real, individual `POST /admin/discounts` calls
 * from the client (`lib/queries/discounts.ts#useBulkGenerateCodesMutation`),
 * each one a distinct, fully real Discount document sharing the same
 * underlying config (type/value/targets/conditions/…) but a unique `code` —
 * this file only owns the pure, testable parts: generating the sequence of
 * unique codes to send, and formatting the per-code result rows as CSV.
 */

/** Deterministic sequential codes (`PREFIX0001`, `PREFIX0002`, …) rather
 *  than random ones — collisions within one batch are impossible by
 *  construction (each `n` is used exactly once), and a human running an
 *  influencer campaign can read a code off a spreadsheet and know exactly
 *  which number it was. The API's own `{ code: 1 }` unique-sparse index is
 *  still the real backstop if two separate batches ever reuse a prefix. */
export function generateSequentialCodes(prefix: string, count: number, startAt = 1, padWidth = 4): string[] {
  const cleanPrefix = prefix.trim().toUpperCase().replace(/\s+/g, '');
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const n = startAt + i;
    const numeric = String(n).padStart(padWidth, '0');
    codes.push(`${cleanPrefix}${numeric}`);
  }
  return codes;
}

export type BulkCodeStatus = 'created' | 'failed';

export interface BulkCodeResult {
  code: string;
  status: BulkCodeStatus;
  discountId?: string;
  error?: string;
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** `code,status,discountId,error` — one row per generated code, in the
 *  exact order they were requested. Consumed client-side only (a `Blob`
 *  download in `BulkCodeGenerator.tsx`) — no backend export endpoint exists
 *  or is needed for this, since the rows are just the codes this session
 *  itself just created. */
export function buildCodesCsv(results: readonly BulkCodeResult[]): string {
  const header = 'code,status,discountId,error';
  const rows = results.map((r) => [csvField(r.code), r.status, csvField(r.discountId ?? ''), csvField(r.error ?? '')].join(','));
  return [header, ...rows].join('\n');
}
