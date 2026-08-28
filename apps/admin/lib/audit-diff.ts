/**
 * Pure diff logic for the Audit log's diff viewer (`components/audit/
 * AuditDiffViewer.tsx`). Framework-free so it's independently testable.
 *
 * What this is diffing, precisely — `AuditLogEntry`'s own doc comment in
 * `@lulwah/contracts` (`audit.ts`) is explicit about this, and this file's
 * job is to not blur that distinction back out: `requestBody` is what the
 * client sent (the intent), `responseBody` is the full entity the API
 * actually returned (the outcome) — NOT a database before/after pair.
 * Because of that, most fields will legitimately show as "only in
 * response" (a `PATCH .../status` request body has one or two fields; the
 * response is the whole order) — that's expected, not a sign of a broken
 * diff.
 */

export type DiffStatus = 'match' | 'differs' | 'requestOnly' | 'responseOnly';

export interface DiffRow {
  path: string;
  requestValue: string | undefined;
  responseValue: string | undefined;
  status: DiffStatus;
}

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;

function stringifyLeaf(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** An empty object/array (including a genuinely empty top-level body, at
 *  `prefix === ''`) still gets one row, keyed `(root)` at the top level or
 *  its own path otherwise — silently emitting nothing would look
 *  identical to "this key doesn't exist on this side" (`buildDiffRows`'s
 *  `undefined` case), which is a different, meaningful fact for a diff
 *  viewer to blur together. */
function flatten(value: unknown, prefix: string, depth: number, out: Map<string, string>): void {
  if (depth > MAX_DEPTH) {
    out.set(prefix || '(root)', JSON.stringify(value));
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.set(prefix || '(root)', '[]');
      return;
    }
    value.slice(0, MAX_ARRAY_ITEMS).forEach((item, i) => flatten(item, `${prefix}[${i}]`, depth + 1, out));
    if (value.length > MAX_ARRAY_ITEMS) {
      out.set(`${prefix}[…]`, `+${value.length - MAX_ARRAY_ITEMS} more item(s)`);
    }
    return;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out.set(prefix || '(root)', '{}');
      return;
    }
    for (const [key, v] of entries) {
      flatten(v, prefix ? `${prefix}.${key}` : key, depth + 1, out);
    }
    return;
  }
  out.set(prefix || '(root)', stringifyLeaf(value));
}

/** Flattens both bodies to `path -> stringified leaf value` maps, then
 *  merges the union of paths into one sorted row list. A path present on
 *  only one side is `requestOnly`/`responseOnly`, not "removed"/"added" —
 *  those words imply a temporal change this data doesn't actually show. */
export function buildDiffRows(requestBody: unknown, responseBody: unknown): DiffRow[] {
  const requestMap = new Map<string, string>();
  const responseMap = new Map<string, string>();
  flatten(requestBody, '', 0, requestMap);
  flatten(responseBody, '', 0, responseMap);

  const paths = Array.from(new Set([...requestMap.keys(), ...responseMap.keys()])).sort();

  return paths.map((path): DiffRow => {
    const requestValue = requestMap.get(path);
    const responseValue = responseMap.get(path);
    let status: DiffStatus;
    if (requestValue === undefined) status = 'responseOnly';
    else if (responseValue === undefined) status = 'requestOnly';
    else if (requestValue === responseValue) status = 'match';
    else status = 'differs';
    return { path, requestValue, responseValue, status };
  });
}
