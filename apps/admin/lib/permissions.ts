import type { UserRole } from '@lulwah/contracts';

/**
 * Client-side UX gate only — mirrors `apps/api/src/modules/identity/
 * identity.policy.ts`'s `ROLE_PERMISSIONS` table for `reviews.write`
 * (verified by reading that file directly, not guessed): it's granted,
 * always alongside `reviews.read`, to exactly `super_admin`, `manager`,
 * `catalog`, and `content` — no role holds `reviews.write` without
 * `reviews.read` in that table, so a role failing this check would also
 * fail the list endpoint's own `reviews.read` gate and never reach this
 * screen's content at all.
 *
 * Real enforcement is entirely server-side (`requireReviewsWrite()`) — a
 * role without this still gets a clean 403 (`isForbiddenError` in
 * `api-client.ts`) if a write request somehow reaches the API regardless.
 * This just hides the approve/reject/reply controls for a role that could
 * never use them (e.g. `support`/`order_ops`/`warehouse`/`finance`, which
 * all hold neither permission), the same "don't show a button that always
 * 403s" courtesy `DiscountsPage`'s own Disable/Activate button doesn't
 * bother with today (discounts.write is far more broadly granted) but
 * reviews' narrower, merchandising-only role set makes worth doing here.
 */
const REVIEWS_WRITE_ROLES: readonly UserRole[] = ['super_admin', 'manager', 'catalog', 'content'];

export function canWriteReviews(role: UserRole | undefined): boolean {
  return !!role && REVIEWS_WRITE_ROLES.includes(role);
}
