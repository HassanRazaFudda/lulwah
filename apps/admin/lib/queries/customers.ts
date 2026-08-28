import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AdminCustomerProfile, Address, Cart, CartItem, CustomerCodRisk, Order } from '@lulwah/contracts';
import { apiRequest } from '../api-client';
import { buildQueryString } from './query-utils';

/**
 * Customer data-fetching layer — `GET/PATCH /admin/customers*` (plan.md
 * §11.1, `apps/api/src/modules/customer/customer.routes.ts` +
 * `customer.dto.ts`). Same `use*Query`/`use*Mutation` shape
 * `queries/orders.ts`/`queries/inventory.ts` already establish, pointed at
 * the real `customer` module that merged to `master` in this phase.
 *
 * Real server-side params on `GET /admin/customers` (verified by reading
 * `customer.service.ts#adminListCustomers`, not assumed): `search`
 * (name/email/phone), `tag` (exact match against one `User.tags` entry —
 * open vocabulary, not a closed enum; plan.md §7.1 only names `vip`/
 * `wholesale`/`risky_cod` as examples), `marketingConsent` (`true` = opted
 * into at least one of email/SMS/WhatsApp, `false` = none), and `sort`
 * (`'createdAt'` default | `'spend'` | `'lastOrder'`). Unlike the Orders
 * screen's client-side column sort (`queries/orders.ts`'s own doc comment
 * — `AdminListOrdersQuery` has no `sort` param at all), `sort` here IS a
 * real query param the server applies — `customer.service.ts`'s own doc
 * comment notes `spend`/`lastOrder` fall back to a bounded in-memory
 * scan+sort (`CUSTOMER_LIST_SORT_SCAN_CAP` = 2,000 accounts) rather than a
 * DB-level sort, but the sorting itself still happens server-side before
 * the response is built, so this hook forwards it as a real filter rather
 * than reordering the fetched page client-side.
 *
 * `page`/`limit` are also real (the server computes `total`/`hasMore` in
 * the response envelope's `meta`), but `apiRequest()` currently discards
 * `meta` entirely (see `api-client.ts` — it returns only `.data`), and this
 * screen follows the same "one generous page, no pagination UI" precedent
 * `queries/products.ts`/`queries/inventory.ts` already set for their own
 * datasets: `limit: 100` (the endpoint's own max), page 1 only. A customer
 * base over 100 accounts would silently show just the first page — a real,
 * known limitation, not fixed here to stay consistent with the sibling
 * screens' own choice rather than inventing a one-off pagination UI just
 * for this screen.
 *
 * `GET /admin/customers/:id`'s embedded order-history panel, by contrast,
 * genuinely IS paginated independently (`ordersPage`/`ordersLimit`,
 * `AdminGetCustomerQuery`) — that pager is real and wired below, not
 * skipped, because the detail response already returns `ordersTotal` for
 * free (no extra `meta`-plumbing needed to know when to stop).
 */

export const CUSTOMER_SORTS = ['createdAt', 'spend', 'lastOrder'] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

/**
 * `GET /admin/customers/:id`'s `currentCart` field is typed server-side as
 * `z.custom<CartResponse>().nullable()` — `CartResponse`
 * (`apps/api/src/modules/cart/cart.dto.ts`) is a module-local response DTO,
 * never exported to `@lulwah/contracts` (same "an assembled response shape
 * stays local to the module that built it" split `queries/products.ts`'s
 * `AdminVariantWithStock` already follows for `product.dto.ts`'s own local
 * extension). This is a hand-mirrored copy of that exact shape —
 * `CartItem` extended with the two read-time-only fields `cart.dto.ts`
 * adds (`priceChanged`, `availableStock`) — kept in sync by hand since
 * there's no shared package to import it from.
 */
const AdminCustomerCartItem = CartItem.extend({
  priceChanged: z.boolean(),
  availableStock: z.number().int(),
});
export type AdminCustomerCartItem = z.infer<typeof AdminCustomerCartItem>;

const AdminCustomerCart = Cart.omit({ items: true }).extend({
  items: z.array(AdminCustomerCartItem),
});
export type AdminCustomerCart = z.infer<typeof AdminCustomerCart>;

const AdminCustomerListResponse = z.object({ customers: z.array(AdminCustomerProfile) });

/** Mirrors `customer.dto.ts#AdminCustomerDetailResponse` — plan.md §11.1's
 *  detail panel: profile, addresses, order history, current cart, COD
 *  risk. Deliberately has no wishlist/reviews/measurement-profile fields —
 *  the backend doesn't return them (nothing in this codebase builds those;
 *  see `customer.dto.ts`'s own doc comment and this task's report). */
const AdminCustomerDetailResponse = z.object({
  customer: AdminCustomerProfile,
  addresses: z.array(Address),
  orders: z.array(Order),
  ordersTotal: z.number().int().nonnegative(),
  currentCart: AdminCustomerCart.nullable(),
  codRisk: CustomerCodRisk,
});
export type AdminCustomerDetailResponse = z.infer<typeof AdminCustomerDetailResponse>;

const AdminCustomerResponse = z.object({ customer: AdminCustomerProfile });

const CUSTOMERS_QUERY_KEY = ['admin', 'customers'] as const;
/** Prefix shared by every cached order-history page for one customer, so a
 *  tag/notes mutation's optimistic update (and its rollback) can hit
 *  whichever page happens to be mounted via TanStack Query's fuzzy
 *  (non-`exact`) key matching, without the mutation needing to know the
 *  caller's current `ordersPage`/`ordersLimit`. */
const customerDetailKeyPrefix = (id: string) => ['admin', 'customer', id] as const;
const customerQueryKey = (id: string, ordersPage: number, ordersLimit: number) =>
  [...customerDetailKeyPrefix(id), ordersPage, ordersLimit] as const;

export interface AdminCustomersFilter {
  search?: string | undefined;
  tag?: string | undefined;
  marketingConsent?: boolean | undefined;
  sort?: CustomerSort | undefined;
}

export function useAdminCustomersQuery(filter: AdminCustomersFilter = {}) {
  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, filter],
    queryFn: () =>
      apiRequest(
        `/admin/customers${buildQueryString({
          search: filter.search,
          tag: filter.tag,
          marketingConsent: filter.marketingConsent,
          sort: filter.sort,
          limit: 100,
        })}`,
        AdminCustomerListResponse,
      ).then((r) => r.customers),
  });
}

export function useAdminCustomerQuery(id: string, ordersPage: number, ordersLimit: number) {
  return useQuery({
    queryKey: customerQueryKey(id, ordersPage, ordersLimit),
    queryFn: () =>
      apiRequest(
        `/admin/customers/${id}${buildQueryString({ ordersPage, ordersLimit })}`,
        AdminCustomerDetailResponse,
      ),
    enabled: id.length > 0,
  });
}

export interface UpdateCustomerVars {
  id: string;
  /** Whole-list replace, matching `UpdateCustomerInput.tags`'s own
   *  documented semantics — not a delta. */
  tags?: string[] | undefined;
  /** Whole-string replace — `notesInternal` is a single free-text field
   *  server-side (unlike `Order.internalNotes[]`'s append-only log), so
   *  there is no separate "add a note" mutation the way
   *  `queries/orders.ts#useAddOrderNoteMutation` has. */
  notesInternal?: string | undefined;
}

interface UpdateCustomerContext {
  previousEntries: [readonly unknown[], AdminCustomerDetailResponse | undefined][];
}

/**
 * `PATCH /admin/customers/:id` — plan.md §11.1's tag editor + internal
 * notes panel, plus §11.2 rule 2 ("optimistic updates on toggles and
 * inline edits, with rollback + toast on failure"). Unlike
 * `queries/orders.ts#useAddOrderNoteMutation` (which found a real DTO gap
 * — notes POST but never come back on any `GET`), this endpoint's write
 * DOES round-trip for real: `customer.service.ts#adminUpdateCustomer`
 * returns the updated profile, and a later `GET` reflects it (confirmed by
 * reading `customer.integration.test.ts`'s own "persists on a later GET"
 * case) — so this mutation's optimistic update is a genuine head start on
 * a real write, not standing in for one that never lands.
 *
 * `tags`/`notesInternal` are independent and optional — a caller sends
 * only the field it's changing, and the other is left untouched
 * server-side (also confirmed by that same test file's "partial write, not
 * a reset" case). This app's own `no toast component exists yet` reality
 * (checked — there isn't one anywhere in `apps/admin`) means "toast on
 * failure" here means the same inline `mutation.isError` message text
 * `OrderDetailPage`/`InventoryAdjustForm` already use, not a literal toast
 * widget.
 */
export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation<AdminCustomerProfile, Error, UpdateCustomerVars, UpdateCustomerContext>({
    mutationFn: ({ id, tags, notesInternal }) =>
      apiRequest(`/admin/customers/${id}`, AdminCustomerResponse, {
        method: 'PATCH',
        body: { tags, notesInternal },
      }).then((r) => r.customer),
    onMutate: async (vars) => {
      const prefix = customerDetailKeyPrefix(vars.id);
      await queryClient.cancelQueries({ queryKey: prefix });
      const previousEntries = queryClient.getQueriesData<AdminCustomerDetailResponse>({ queryKey: prefix });

      queryClient.setQueriesData<AdminCustomerDetailResponse>({ queryKey: prefix }, (old) => {
        if (!old) return old;
        return {
          ...old,
          customer: {
            ...old.customer,
            ...(vars.tags !== undefined ? { tags: vars.tags } : {}),
            ...(vars.notesInternal !== undefined ? { notesInternal: vars.notesInternal } : {}),
          },
        };
      });

      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      context?.previousEntries.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: customerDetailKeyPrefix(vars.id) });
      void queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
    },
  });
}
