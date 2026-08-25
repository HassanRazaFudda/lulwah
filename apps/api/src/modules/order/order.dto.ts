import { z } from 'zod';
import { Order, OrderStatus, PaymentStatus, UpdateOrderStatusInput } from '@lulwah/contracts';

/**
 * Request/response DTOs for `order` — plan.md §9.7 (admin), the `/me`
 * customer-facing slice, and guest tracking. `Order`/`UpdateOrderStatusInput`
 * themselves live in `@lulwah/contracts` (plan.md §6.1: "reproduced
 * verbatim... the canonical example of the contracts pattern") — reused
 * as-is here, never redefined.
 */
export { UpdateOrderStatusInput };

export const AdminListOrdersQuery = z.object({
  status: OrderStatus.optional(),
  paymentStatus: PaymentStatus.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListOrdersQuery = z.infer<typeof AdminListOrdersQuery>;

export const AdminOrderListResponse = z.object({ orders: z.array(Order) });
export type AdminOrderListResponse = z.infer<typeof AdminOrderListResponse>;

export const OrderResponse = z.object({ order: Order });
export type OrderResponse = z.infer<typeof OrderResponse>;

/** `POST /admin/orders/:id/notes` — plan.md §9.7. Internal staff notes,
 *  distinct from the customer-status-change `statusHistory[].note` trail
 *  (see `order.model.ts`'s doc comment on `internalNotes`). */
export const AdminAddOrderNoteInput = z.object({ note: z.string().min(1).max(2000) });
export type AdminAddOrderNoteInput = z.infer<typeof AdminAddOrderNoteInput>;

export const MeOrdersQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
export type MeOrdersQuery = z.infer<typeof MeOrdersQuery>;

/** `GET /orders/track` — plan.md §8.7.5. Guest tracking: no login, so the
 *  order number plus the email/phone on file together stand in for auth. */
export const TrackOrderQuery = z.object({
  orderNumber: z.string().regex(/^LF-\d{6}-\d{4}$/, 'Enter a valid order number, e.g. LF-260825-0001.'),
  emailOrPhone: z.string().min(3),
});
export type TrackOrderQuery = z.infer<typeof TrackOrderQuery>;
