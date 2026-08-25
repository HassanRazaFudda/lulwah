import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Order, OrderStatus, PaymentStatus } from '@lulwah/contracts';
import type { OrderStatusHistoryEntry } from '@lulwah/contracts';
import { apiRequest } from '../api-client';
import { getSessionUser } from '../auth-session';
import { buildQueryString } from './query-utils';

/**
 * Order data-fetching layer — `GET/PATCH /admin/orders*`, `POST
 * /admin/orders/:id/notes` (plan.md §9.7, `apps/api/src/modules/order/
 * order.routes.ts`). Same `use*Query`/`use*Mutation` shape
 * `queries/products.ts`/`queries/inventory.ts` already establish, now
 * pointed at the real `order` module that merged to `master` in this phase
 * (see `docs/implemented-plan.md` §4.6) instead of `lib/queries.ts`'s old
 * placeholder-array implementation.
 *
 * Unlike the Products screen's stitchingType/brand filters (see
 * `queries/products.ts`'s doc comment on why those stayed client-side),
 * `status`/`paymentStatus`/`search` genuinely ARE applied server-side here
 * — verified by reading `order.repository.ts#adminListOrders`, not
 * assumed — so they're sent as real query params, matching
 * `queries/inventory.ts`'s precedent for a filter that's real.
 *
 * `AdminListOrdersQuery` (`order.dto.ts`) has no `dateFrom`/`dateTo`/
 * `emirate`/`sort` params at all — the brief that asked for this file
 * assumed the endpoint might support a fuller `?status&payment&dateFrom
 * &dateTo&emirate&q&sort&page&limit` shape; it doesn't. This file doesn't
 * pretend otherwise: only `status`, `paymentStatus`, and `search` (order
 * number / guest email / guest phone — not shipping-address name) are
 * forwarded. `order.repository.ts`'s own sort is a fixed `createdAt: -1`;
 * the Orders list page's client-side sort-by-date/total stays as a
 * within-the-fetched-page reorder, same as it always was.
 */

const AdminOrderListResponse = z.object({ orders: z.array(Order) });
const OrderResponse = z.object({ order: Order });

const ORDERS_QUERY_KEY = ['admin', 'orders'] as const;
const orderQueryKey = (id: string) => ['admin', 'order', id] as const;

export interface AdminOrdersFilter {
  status?: OrderStatus | undefined;
  paymentStatus?: PaymentStatus | undefined;
  search?: string | undefined;
}

/**
 * Fetches one generous page (limit 100 — comfortably above this app's
 * current live-order volume; the same "one page, no pagination UI" choice
 * `queries/products.ts`/`queries/inventory.ts` already made for their own
 * small datasets) with `status`/`paymentStatus`/`search` forwarded as real
 * query params rather than fetched-then-filtered client-side.
 */
export function useAdminOrdersQuery(filter: AdminOrdersFilter = {}) {
  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, filter],
    queryFn: () =>
      apiRequest(
        `/admin/orders${buildQueryString({
          status: filter.status,
          paymentStatus: filter.paymentStatus,
          search: filter.search,
          limit: 100,
        })}`,
        AdminOrderListResponse,
      ).then((r) => r.orders),
  });
}

export function useAdminOrderQuery(id: string) {
  return useQuery({
    queryKey: orderQueryKey(id),
    queryFn: () => apiRequest(`/admin/orders/${id}`, OrderResponse).then((r) => r.order),
    enabled: id.length > 0,
  });
}

/** `UpdateOrderStatusInput.carrier` (`@lulwah/contracts`' `order.ts`) is an
 *  inline five-value enum, never exported as its own named schema — this is
 *  the admin console's own copy of exactly those five literals, for the
 *  shipped-status mini-form's `<select>` (plan.md §8.7.4). */
export const CARRIERS = ['aramex', 'emirates_post', 'careem', 'fetchr', 'own_fleet'] as const;
export type OrderCarrier = (typeof CARRIERS)[number];
export const CARRIER_LABELS: Record<OrderCarrier, string> = {
  aramex: 'Aramex',
  emirates_post: 'Emirates Post',
  careem: 'Careem',
  fetchr: 'Fetchr',
  own_fleet: 'Own fleet',
};

export interface UpdateOrderStatusVars {
  orderId: string;
  nextStatus: OrderStatus;
  // `| undefined` spelled out explicitly — `exactOptionalPropertyTypes`
  // (plan.md §27.1) means an optional key typed just `string` rejects an
  // explicit `undefined` value, and call sites here build these from
  // `string | undefined` expressions (e.g. `x.trim() || undefined`).
  note?: string | undefined;
  notifyCustomer: boolean;
  trackingNumber?: string | undefined;
  carrier?: OrderCarrier | undefined;
}

interface UpdateOrderStatusContext {
  previousOrder: Order | undefined;
}

function optimisticNextOrder(order: Order, vars: UpdateOrderStatusVars): Order {
  const entry: OrderStatusHistoryEntry = {
    from: order.status,
    to: vars.nextStatus,
    at: new Date(),
    byUserId: getSessionUser()?.id ?? 'system',
    note: vars.note,
    notifiedCustomer: vars.notifyCustomer,
  };
  return { ...order, status: vars.nextStatus, statusHistory: [...order.statusHistory, entry] };
}

/**
 * `PATCH /admin/orders/:id/status` — plan.md §8.7.4's status control +
 * §11.2 rule 2 ("optimistic updates on toggles and inline edits, with
 * rollback + toast on failure"), now against the real endpoint instead of
 * `lib/queries.ts`'s old placeholder mutation.
 *
 * `StatusTransitionDropdown` only ever offers a status this order's
 * current status can legally reach (`getValidNextStatuses` — untouched,
 * see that file's own doc comment on being the single source of truth),
 * so this mutation doesn't re-validate the transition client-side the way
 * the placeholder version did via `isValidOrderStatusTransition` — the
 * real server (`order.transitions.ts#assertValidOrderStatusTransition`) is
 * the actual source of truth now. A `409 INVALID_STATUS_TRANSITION` (a
 * network race or stale client state — never reachable by construction
 * through the dropdown alone) surfaces as a normal `ApiClientError` via
 * `mutation.error`, not swallowed; `onSettled` always refetches the order
 * regardless of outcome so the dropdown recomputes valid next states from
 * the order's real current status afterward.
 */
export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation<Order, Error, UpdateOrderStatusVars, UpdateOrderStatusContext>({
    mutationFn: ({ orderId, nextStatus, note, notifyCustomer, trackingNumber, carrier }) =>
      apiRequest(`/admin/orders/${orderId}/status`, OrderResponse, {
        method: 'PATCH',
        body: { status: nextStatus, note, notifyCustomer, trackingNumber, carrier },
      }).then((r) => r.order),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: orderQueryKey(vars.orderId) });
      const previousOrder = queryClient.getQueryData<Order>(orderQueryKey(vars.orderId));
      if (previousOrder) {
        queryClient.setQueryData<Order>(orderQueryKey(vars.orderId), optimisticNextOrder(previousOrder, vars));
      }
      return { previousOrder };
    },
    onError: (_err, vars, context) => {
      if (context?.previousOrder) {
        queryClient.setQueryData(orderQueryKey(vars.orderId), context.previousOrder);
      }
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: orderQueryKey(vars.orderId) });
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}

/**
 * `POST /admin/orders/:id/notes` — plan.md §9.7. This writes for real (the
 * note is durably persisted on `Order.internalNotes` in Mongo — confirmed
 * live, see the task report), but `order.mapper.ts#toOrderDto` deliberately
 * never puts `internalNotes` on the wire `Order` DTO (see that file's and
 * `order.model.ts`'s own doc comments — it's an internal-only Mongoose
 * field), and there is no `GET` for notes either. So a note posted through
 * this mutation cannot be read back through any endpoint this app can call.
 * `OrderDetailPage` keeps its own session-local list of successfully-posted
 * notes for display and says so in the UI, rather than pretending this is a
 * full round-trip — see this task's report for why fixing the DTO itself is
 * out of scope (`apps/api` is done/merged, not to be touched here).
 */
export function useAddOrderNoteMutation(orderId: string) {
  return useMutation({
    mutationFn: (note: string) =>
      apiRequest(`/admin/orders/${orderId}/notes`, OrderResponse, { method: 'POST', body: { note } }).then(
        (r) => r.order,
      ),
  });
}
