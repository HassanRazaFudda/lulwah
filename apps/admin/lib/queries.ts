import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Order, OrderStatus, OrderStatusHistoryEntry } from '@lulwah/contracts';
import { DASHBOARD_STATS, LOW_STOCK_ITEMS, ORDERS_NEEDING_ACTION } from './placeholder-dashboard';
import { ADMIN_ORDERS, findAdminOrderById } from './placeholder-orders';
import { isValidOrderStatusTransition } from './order-status';

/**
 * Data-fetching layer — plan.md §4.1 picks TanStack Query for cache,
 * retry and optimistic updates. `apps/api` is a separate, parallel
 * workstream and doesn't exist in this worktree yet, so the `fetch*`
 * functions below resolve local placeholder data behind an artificial
 * delay (so the skeleton states in `DataTable`/`StatTile` call sites are
 * actually visible, matching §11.2 rule 1: "Never a full-page spinner.
 * Skeletons matching the final layout"). Swapping these for real
 * `apiRequest(...)` calls later doesn't change any hook's public shape.
 */
function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const ORDERS_QUERY_KEY = ['admin', 'orders'] as const;
const orderQueryKey = (id: string) => ['admin', 'order', id] as const;
const DASHBOARD_QUERY_KEY = ['admin', 'dashboard'] as const;

async function fetchOrders(): Promise<Order[]> {
  return delay(ADMIN_ORDERS);
}

async function fetchOrderById(id: string): Promise<Order | undefined> {
  return delay(findAdminOrderById(id));
}

async function fetchDashboardData() {
  return delay({ stats: DASHBOARD_STATS, actionItems: ORDERS_NEEDING_ACTION, lowStock: LOW_STOCK_ITEMS });
}

export function useAdminOrdersQuery() {
  return useQuery({ queryKey: ORDERS_QUERY_KEY, queryFn: fetchOrders });
}

export function useAdminOrderQuery(id: string) {
  return useQuery({
    queryKey: orderQueryKey(id),
    queryFn: () => fetchOrderById(id),
    enabled: id.length > 0,
  });
}

export function useDashboardQuery() {
  return useQuery({ queryKey: DASHBOARD_QUERY_KEY, queryFn: fetchDashboardData });
}

export interface UpdateOrderStatusVars {
  orderId: string;
  nextStatus: OrderStatus;
  // `| undefined` spelled out explicitly — `exactOptionalPropertyTypes`
  // (plan.md §27.1) means an optional key typed just `string` rejects an
  // explicit `undefined` value, and call sites here build `note` from a
  // `string | undefined` expression (e.g. `x.trim() || undefined`).
  note?: string | undefined;
  notifyCustomer: boolean;
}

interface UpdateOrderStatusContext {
  previousOrder: Order | undefined;
}

function appendHistoryEntry(order: Order, vars: UpdateOrderStatusVars): Order {
  const entry: OrderStatusHistoryEntry = {
    from: order.status,
    to: vars.nextStatus,
    at: new Date(),
    byUserId: 'system', // placeholder actor — real session user once auth exists
    note: vars.note,
    notifiedCustomer: vars.notifyCustomer,
  };
  return { ...order, status: vars.nextStatus, statusHistory: [...order.statusHistory, entry] };
}

/**
 * plan.md §8.7.4's status control + §11.2 rule 2 ("optimistic updates on
 * toggles and inline edits, with rollback + toast on failure") in one
 * hook. `mutationFn` re-validates the transition through the exact same
 * `isValidOrderStatusTransition` the dropdown used to decide which options
 * to render at all — belt and suspenders, the same way the real
 * `PATCH /admin/orders/:id/status` endpoint (§9.7) must re-check
 * server-side even though the UI already made an illegal choice
 * unreachable (§10.2: "never in the UI alone").
 */
export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation<Order, Error, UpdateOrderStatusVars, UpdateOrderStatusContext>({
    mutationFn: async (vars) => {
      const current = findAdminOrderById(vars.orderId);
      if (!current) throw new Error('Order not found');
      if (!isValidOrderStatusTransition(current.status, vars.nextStatus)) {
        throw new Error(`Invalid transition: ${current.status} -> ${vars.nextStatus}`);
      }
      return delay(appendHistoryEntry(current, vars), 500);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: orderQueryKey(vars.orderId) });
      const previousOrder = queryClient.getQueryData<Order>(orderQueryKey(vars.orderId));
      if (previousOrder) {
        queryClient.setQueryData<Order>(orderQueryKey(vars.orderId), appendHistoryEntry(previousOrder, vars));
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
