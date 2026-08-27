import { z } from 'zod';
import { Address, AdminCustomerProfile, CustomerCodRisk, Order, UpdateCustomerInput } from '@lulwah/contracts';
import type { CartResponse } from '../cart/cart.dto.js';

/**
 * Request/response DTOs for `customer` — plan.md §11.1. `AdminCustomerProfile`/
 * `CustomerCodRisk`/`UpdateCustomerInput` live in `@lulwah/contracts`
 * (reused, not redefined); everything below is either a query-string shape
 * or a page-level response composite this module alone produces — the same
 * "an assembled page response stays local to the module that builds it,
 * the domain entities it's built from live in contracts" split
 * `product.dto.ts`'s `ProductDetailResponse`/`AdminProductDetailResponse`
 * already establish for `catalog`.
 */
export { UpdateCustomerInput };

const booleanParam = () =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true'));

export const CustomerSort = z.enum(['createdAt', 'spend', 'lastOrder']);
export type CustomerSort = z.infer<typeof CustomerSort>;

/**
 * `GET /admin/customers` — plan.md §11.1: "List with orders, spend, last
 * order, tags, marketing consent." `search` matches name/email/phone;
 * `tag` is an exact match against one of `User.tags`; `marketingConsent`
 * filters to accounts opted into at least one channel (`true`) or none
 * (`false`) — plan.md doesn't specify per-channel filtering, so this is a
 * documented, single reasonable reading, not a literal transcription.
 */
export const AdminListCustomersQuery = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  marketingConsent: booleanParam(),
  sort: CustomerSort.default('createdAt'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminListCustomersQuery = z.infer<typeof AdminListCustomersQuery>;

export const AdminListCustomersResponse = z.object({ customers: z.array(AdminCustomerProfile) });
export type AdminListCustomersResponse = z.infer<typeof AdminListCustomersResponse>;

/** `GET /admin/customers/:id` — paginates the embedded order-history panel
 *  independently of the detail fetch itself, so a customer with a long
 *  order history doesn't force every field of every order onto the wire
 *  by default. */
export const AdminGetCustomerQuery = z.object({
  ordersPage: z.coerce.number().int().positive().default(1),
  ordersLimit: z.coerce.number().int().positive().max(50).default(20),
});
export type AdminGetCustomerQuery = z.infer<typeof AdminGetCustomerQuery>;

/**
 * `GET /admin/customers/:id` — plan.md §11.1's detail panel: profile,
 * addresses, order history, current cart, tags (on `customer` itself),
 * internal notes (also on `customer`), COD risk flags.
 *
 * Deliberately does NOT include wishlist, reviews, or measurement
 * profiles — no such module/collection exists anywhere in this codebase
 * (checked before writing this file, per plan.md §11.1's own row and this
 * module's task brief). Silently omitting them would misrepresent them as
 * "not applicable to this customer" rather than "not built yet" — see the
 * `customer` module's own report instead.
 */
export const AdminCustomerDetailResponse = z.object({
  customer: AdminCustomerProfile,
  addresses: z.array(Address),
  orders: z.array(Order),
  ordersTotal: z.number().int().nonnegative(),
  /** `null` when the customer has no active cart — the ordinary case, not
   *  an error (see `cart.service.ts#getActiveCartForUser`'s doc comment).
   *  Typed via the cart module's own response shape rather than redefined
   *  here — same type-only cross-module reference `checkout.service.ts`
   *  already uses for `ReservationStore`/`ApplyDiscountsResult`. */
  currentCart: z.custom<CartResponse>().nullable(),
  codRisk: CustomerCodRisk,
});
export type AdminCustomerDetailResponse = z.infer<typeof AdminCustomerDetailResponse>;

export const AdminCustomerResponse = z.object({ customer: AdminCustomerProfile });
export type AdminCustomerResponse = z.infer<typeof AdminCustomerResponse>;
