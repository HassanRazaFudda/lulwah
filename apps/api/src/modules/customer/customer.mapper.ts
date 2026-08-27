import type { AdminCustomerProfile } from '@lulwah/contracts';
import type { CustomerOrderStats } from '../order/order.service.js';

/**
 * `customer` owns no collection of its own (plan.md §5.3) — there is no
 * doc↔dto mapping here the way `identity.mapper.ts`/`order.mapper.ts` have.
 * What this file shapes instead is the *composition*: merging a live,
 * freshly-computed `order`-module stat block onto the (currently inert —
 * see `order.service.ts#getCustomerOrderStats`'s doc comment) `stats`
 * field `identity` persists on the profile itself, so `customer.service.ts`
 * stays about orchestration/permissions rather than reshaping.
 */
export function withLiveStats(profile: AdminCustomerProfile, stats: CustomerOrderStats): AdminCustomerProfile {
  return { ...profile, stats };
}
