import { z } from 'zod';
import { Order, OrderShippingMethod, OrderStatus } from '@lulwah/contracts';

/**
 * Response-shape schemas for the `order` module's customer-facing and
 * guest-tracking endpoints (`apps/api/src/modules/order/order.dto.ts`,
 * `order.mapper.ts#toPublicTrackingView`). `Order` itself is the shared
 * `@lulwah/contracts` schema; the tracking view is this module's own
 * deliberately-reduced shape (no money, no payment detail, no internal
 * status-change notes — plan.md §8.7.5) and has no wire contract of its
 * own to reuse, so it's re-declared here the same way `checkout-schemas.ts`
 * re-declares `checkout`'s module-local DTOs.
 *
 * **A real bug, caught by live verification (see task report):**
 * `@lulwah/contracts`' `OrderShippingMethod.id` is typed `objectId` (a
 * strict 24-hex-char Mongo id), but the real `checkout`/`order` code
 * populates it from `checkout/shipping-rates.ts#quoteShipping`'s flat-rate
 * quote, whose `id` is the literal string `'standard'` (plan.md §21: R1
 * shipping is a hardcoded table, not a `ShippingMethod` collection with
 * real ids) — so every real placed order's `shippingMethod.id` fails
 * strict `objectId` validation against the shared contract. Confirmed live
 * against this repo's running API: `POST /checkout/session/:id/place`'s
 * real response has `order.shippingMethod.id === "standard"`. Fixing the
 * contract itself is out of this workstream's scope (`apps/api` is done/
 * merged, and `packages/contracts` is shared with `apps/admin`, being
 * wired by a parallel agent right now) — widened locally instead so a real
 * placed order doesn't throw `ApiError('UNKNOWN_RESPONSE_SHAPE', ...)` on
 * the client. `RealOrder` is `Order` with only that one field relaxed.
 */
export const RealOrder = Order.extend({
  shippingMethod: OrderShippingMethod.extend({ id: z.string() }),
});
export type RealOrder = z.infer<typeof RealOrder>;

export const OrderResponse = z.object({ order: RealOrder });
export type OrderResponse = z.infer<typeof OrderResponse>;

export const MyOrdersResponse = z.object({ orders: z.array(RealOrder) });
export type MyOrdersResponse = z.infer<typeof MyOrdersResponse>;

const PublicShipmentEvent = z.object({
  code: z.string(),
  description: z.string(),
  at: z.coerce.date(),
  location: z.string().optional(),
});

const PublicShipment = z.object({
  id: z.string(),
  carrier: z.string(),
  trackingNumber: z.string(),
  trackingUrl: z.string().optional(),
  awb: z.string().optional(),
  items: z.array(z.object({ itemId: z.string(), quantity: z.number().int().positive() })),
  shippedAt: z.coerce.date().nullable(),
  deliveredAt: z.coerce.date().nullable(),
  events: z.array(PublicShipmentEvent),
});

export const PublicOrderTrackingView = z.object({
  orderNumber: z.string(),
  status: OrderStatus,
  statusHistory: z.array(z.object({ to: OrderStatus, at: z.coerce.date() })),
  shippingMethod: z.object({ id: z.string(), name: z.string(), carrier: z.string(), etaMinDays: z.number(), etaMaxDays: z.number(), priceFils: z.number() }),
  shipments: z.array(PublicShipment),
  placedAt: z.coerce.date(),
  deliveredAt: z.coerce.date().nullable(),
});
export type PublicOrderTrackingView = z.infer<typeof PublicOrderTrackingView>;

export const TrackOrderResponse = z.object({ order: PublicOrderTrackingView });
export type TrackOrderResponse = z.infer<typeof TrackOrderResponse>;
