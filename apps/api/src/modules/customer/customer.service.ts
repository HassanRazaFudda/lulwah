import type { AdminCustomerProfile, UpdateCustomerInput } from '@lulwah/contracts';
import { CUSTOMER_LIST_SORT_SCAN_CAP } from '../../config/constants.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as identityService from '../identity/identity.service.js';
import * as addressService from '../identity/address.service.js';
import * as orderService from '../order/order.service.js';
import * as cartService from '../cart/cart.service.js';
import { withLiveStats } from './customer.mapper.js';
import type { AdminCustomerDetailResponse, AdminListCustomersQuery } from './customer.dto.js';

/**
 * ALL customer-admin orchestration lives here, framework-free (no
 * `express` import — plan.md §5.4). This module owns no collection of its
 * own: every read/write below goes through `identity`/`order`/`cart`'s own
 * exported service functions (plan.md §5.3), never their Mongoose models.
 * Each of those functions re-checks its own relevant permission
 * (`customers.read`/`write` inside `identity`, `orders.read` inside
 * `order`) — this file doesn't re-check a third time on top, the same
 * "the sub-call is the enforcement point" trust `cart.service.ts` already
 * extends to `identityService.me()`/`getAddressSnapshot`.
 */

function emptyStats(): { orderCount: number; totalSpentFils: number; avgOrderValueFils: number; lastOrderAt: Date | null } {
  return { orderCount: 0, totalSpentFils: 0, avgOrderValueFils: 0, lastOrderAt: null };
}

/**
 * `GET /admin/customers` — plan.md §11.1. `sort: 'createdAt'` (the
 * default) stays a single efficient DB-level paginated query; `'spend'`/
 * `'lastOrder'` fall back to the bounded in-memory scan documented on
 * `CUSTOMER_LIST_SORT_SCAN_CAP` — see that constant's own doc comment for
 * why a true DB-level cross-collection sort isn't available here yet.
 */
export async function adminListCustomers(actor: AuthenticatedUser, query: AdminListCustomersQuery): Promise<{ customers: AdminCustomerProfile[]; total: number }> {
  const filter = { search: query.search, tag: query.tag, marketingConsent: query.marketingConsent };

  if (query.sort === 'createdAt') {
    const { customers, total } = await identityService.adminListCustomers(actor, filter, query.page, query.limit);
    const stats = await orderService.getCustomerOrderStatsBulk(
      actor,
      customers.map((c) => c.id),
    );
    return { customers: customers.map((c) => withLiveStats(c, stats.get(c.id) ?? emptyStats())), total };
  }

  const { customers: all } = await identityService.adminListCustomers(actor, filter, 1, CUSTOMER_LIST_SORT_SCAN_CAP);
  const stats = await orderService.getCustomerOrderStatsBulk(
    actor,
    all.map((c) => c.id),
  );
  const withStats = all.map((c) => withLiveStats(c, stats.get(c.id) ?? emptyStats()));
  withStats.sort((a, b) => {
    if (query.sort === 'spend') return b.stats.totalSpentFils - a.stats.totalSpentFils;
    const bTime = b.stats.lastOrderAt ? b.stats.lastOrderAt.getTime() : 0;
    const aTime = a.stats.lastOrderAt ? a.stats.lastOrderAt.getTime() : 0;
    return bTime - aTime;
  });

  const start = (query.page - 1) * query.limit;
  return { customers: withStats.slice(start, start + query.limit), total: withStats.length };
}

/** `GET /admin/customers/:id` — plan.md §11.1's detail panel. Composes
 *  five independent reads in parallel: `identity` owns the profile (and
 *  is what 404s if `id` isn't a real customer — every other read below
 *  trusts that check already happened), `identity/address.service.ts`
 *  owns the address book, `order` owns history/spend/COD risk, `cart`
 *  owns the live cart. */
export async function adminGetCustomer(actor: AuthenticatedUser, id: string, ordersPage: number, ordersLimit: number): Promise<AdminCustomerDetailResponse> {
  const customer = await identityService.adminGetCustomerProfile(actor, id);

  const [addresses, orderHistory, currentCart, stats, codRisk] = await Promise.all([
    addressService.listAddresses(id),
    orderService.adminListOrders(actor, { userId: id }, ordersPage, ordersLimit),
    cartService.getActiveCartForUser(id),
    orderService.getCustomerOrderStats(actor, id),
    orderService.getCustomerCodRisk(actor, id),
  ]);

  return {
    customer: withLiveStats(customer, stats),
    addresses,
    orders: orderHistory.orders,
    ordersTotal: orderHistory.total,
    currentCart,
    codRisk: { ...codRisk, taggedRisky: customer.tags.includes('risky_cod') },
  };
}

/** `PATCH /admin/customers/:id` — plan.md §11.1's tag editor + internal
 *  notes panel. */
export async function adminUpdateCustomer(actor: AuthenticatedUser, id: string, input: UpdateCustomerInput): Promise<AdminCustomerProfile> {
  const updated = await identityService.adminUpdateCustomer(actor, id, input);
  const stats = await orderService.getCustomerOrderStats(actor, id);
  return withLiveStats(updated, stats);
}
