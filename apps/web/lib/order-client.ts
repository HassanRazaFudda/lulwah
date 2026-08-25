import { apiFetch } from './api-client';
import { MyOrdersResponse, OrderResponse, TrackOrderResponse } from './order-schemas';

/**
 * Thin fetch functions over `apiFetch` for `order`'s customer-facing slice
 * (`apps/api/src/modules/order/order.routes.ts`). `getMyOrders`/
 * `getMyOrderByNumber` need a logged-in session (`requireAuth()`
 * server-side) — the storefront has no auth/session UI yet (out of this
 * workstream's scope, see the task report), so `trackOrder` (guest, no
 * login, rate-limited 10/min/IP) is the one of these actually wired to a
 * page right now (`account/orders/page.tsx`).
 */

export async function trackOrder(orderNumber: string, emailOrPhone: string): Promise<TrackOrderResponse['order']> {
  const query = new URLSearchParams({ orderNumber, emailOrPhone }).toString();
  const { order } = await apiFetch(`/orders/track?${query}`, TrackOrderResponse);
  return order;
}

export async function getMyOrders(): Promise<MyOrdersResponse['orders']> {
  const { orders } = await apiFetch('/me/orders', MyOrdersResponse);
  return orders;
}

export async function getMyOrderByNumber(orderNumber: string): Promise<OrderResponse['order']> {
  const { order } = await apiFetch(`/me/orders/${encodeURIComponent(orderNumber)}`, OrderResponse);
  return order;
}
