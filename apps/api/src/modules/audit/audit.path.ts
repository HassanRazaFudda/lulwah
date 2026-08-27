/**
 * Pure, framework-free derivation of an audit entry's `action`/`entityType`/
 * `entityId` from the HTTP method + Express-relative path alone — no
 * per-module route table to keep in sync (plan.md §5.3: this module never
 * imports another module's routes/model to figure this out).
 *
 * Every admin router in this codebase (`catalog`, `inventory`, `pricing`,
 * `order`, `identity`) follows the same shape: `/admin/<entityType>` or
 * `/admin/<entityType>/<objectId>[/<verb-or-sub-resource>...]` — see
 * `audit.path.test.ts` for real examples pulled from those routers. This
 * function only *assumes* that shape; it doesn't hardcode any specific
 * module's routes, so a brand-new admin module needs no change here to be
 * audited correctly, and a route shaped unusually just degrades to a
 * `null` entityType/entityId rather than throwing.
 */

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

export interface DerivedAuditMeta {
  /** Human-scannable label, e.g. "PATCH /admin/orders/:id/status" — every
   *  ObjectId-shaped segment is normalized to `:id` so the same route
   *  hit for two different orders produces the same `action` string,
   *  useful for grouping/filtering later. */
  action: string;
  /** First path segment after `/admin/`, e.g. "orders" — `null` only if
   *  the path isn't under `/admin/` at all (shouldn't happen; the
   *  middleware itself already filters to `/admin/*`). */
  entityType: string | null;
  /** First ObjectId-shaped (`/^[0-9a-f]{24}$/i`) path segment, if any —
   *  `null` for a collection-level route with no id (e.g. `POST
   *  /admin/discounts`). A route with more than one id (none exist in
   *  this codebase today) only surfaces the first. */
  entityId: string | null;
}

export function deriveAuditMeta(method: string, path: string): DerivedAuditMeta {
  const segments = path.split('/').filter((s) => s.length > 0);
  const afterAdmin = segments[0] === 'admin' ? segments.slice(1) : segments;

  const entityType = afterAdmin[0] ?? null;
  const entityId = afterAdmin.find((seg) => OBJECT_ID_RE.test(seg)) ?? null;

  const normalizedPath = `/${segments.map((seg) => (OBJECT_ID_RE.test(seg) ? ':id' : seg)).join('/')}`;
  const action = `${method} ${normalizedPath}`;

  return { action, entityType, entityId };
}
