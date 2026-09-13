import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Wishlist } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * `GET /admin/customers/:id/wishlist` — Customer detail screen's own
 * Wishlist panel (plan.md §11.1: "wishlist, reviews"; backed by
 * `apps/api/src/modules/engagement/wishlist.controller.ts
 * #adminGetForCustomer`). The endpoint returns `{ wishlist: null }` (not a
 * 404) for a customer with no wishlist yet — the ordinary state for most
 * customers, per that controller's own doc comment — so this is modelled
 * as `Wishlist | null`, not treated as an error the way a missing customer
 * record would be.
 *
 * No mutation hooks here: this screen only reads a customer's wishlist for
 * staff visibility, it doesn't edit it — writing to a customer's wishlist
 * is a self-service `/me/wishlist*` action, not an admin one (see
 * `engagement.routes.ts`).
 */
const AdminWishlistResponse = z.object({ wishlist: Wishlist.nullable() });

export function useAdminCustomerWishlistQuery(customerId: string) {
  return useQuery({
    queryKey: ['admin', 'customer', customerId, 'wishlist'],
    queryFn: () => apiRequest(`/admin/customers/${customerId}/wishlist`, AdminWishlistResponse).then((r) => r.wishlist),
    enabled: customerId.length > 0,
  });
}
