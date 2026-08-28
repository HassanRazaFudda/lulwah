import { z } from 'zod';
import { AddressLabel, Emirate, PaymentMethod, UserPhone, objectId } from '@lulwah/contracts';
import { RealOrder } from './order-schemas';

/**
 * Response-shape schemas for the `checkout` module (`apps/api/src/modules/
 * checkout/checkout.dto.ts`). No `CheckoutSession` wire contract exists in
 * `@lulwah/contracts` (that module's own doc comment: no consumer needed
 * one until now) — re-declared here from shared `@lulwah/contracts`
 * primitives, same "module-local DTO, shared field types" pattern
 * `cart-schemas.ts`/`catalog-schemas.ts` already use.
 */

const CheckoutSessionItemView = z.object({
  productId: objectId,
  variantId: objectId,
  quantity: z.number().int().positive(),
  unitPriceFils: z.number().int().nonnegative(),
  compareAtPriceFils: z.number().int().nonnegative().nullable(),
  titleSnapshot: z.string(),
  brandSnapshot: z.string(),
  imageSnapshot: z.string(),
});

const CheckoutSessionAddressView = z.object({
  label: AddressLabel,
  firstName: z.string(),
  lastName: z.string(),
  phone: UserPhone,
  emirate: Emirate,
  city: z.string(),
  area: z.string(),
  buildingName: z.string(),
  apartment: z.string().optional(),
  street: z.string().optional(),
  landmark: z.string(),
  makani: z.string().nullable(),
  poBox: z.string().nullable(),
  geo: z.object({ lat: z.number(), lng: z.number() }).nullable(),
});

export const CheckoutSessionResponse = z.object({
  sessionId: z.string(),
  cartId: z.string(),
  items: z.array(CheckoutSessionItemView),
  totals: z.object({
    subtotalFils: z.number().int().nonnegative(),
    discountFils: z.number().int().nonnegative(),
    shippingFils: z.number().int().nonnegative(),
    codFeeFils: z.number().int().nonnegative(),
    taxFils: z.number().int().nonnegative(),
    grandTotalFils: z.number().int().nonnegative(),
  }),
  shippingAddress: CheckoutSessionAddressView.nullable(),
  billingAddress: CheckoutSessionAddressView.nullable(),
  shippingMethod: z
    .object({ id: z.string(), name: z.string(), carrier: z.string(), etaMinDays: z.number(), etaMaxDays: z.number(), priceFils: z.number() })
    .nullable(),
  paymentMethod: PaymentMethod.nullable(),
  /** Set once `place()` has created the `Order` for this session
   *  (`apps/api/src/modules/checkout/checkout.repository.ts#markCompleted`)
   *  — `null` until then. The Ziina return page
   *  (`app/[locale]/(checkout)/checkout/session/[sessionId]/return/page.tsx`)
   *  reads this off `getCheckoutSession()` to resolve which order to show,
   *  with no new endpoint needed. */
  orderNumber: z.string().nullable(),
  status: z.enum(['open', 'completed', 'expired']),
  expiresAt: z.coerce.date(),
});
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponse>;

export const PaymentIntentResponse = z.object({
  method: PaymentMethod,
  redirectUrl: z.string().nullable(),
  otpRequired: z.boolean(),
});
export type PaymentIntentResponse = z.infer<typeof PaymentIntentResponse>;

/** `POST /checkout/session/:id/place` — `checkout.controller.ts#place`
 *  returns `{ order }`, the full `@lulwah/contracts` `Order` (same object
 *  `order.dto.ts#OrderResponse` wraps) — via `RealOrder` (`order-schemas.ts`),
 *  which relaxes the one field (`shippingMethod.id`) the real API's data
 *  doesn't actually satisfy the strict shared contract for; see that
 *  file's doc comment. */
export const PlaceOrderResponse = z.object({ order: RealOrder });
export type PlaceOrderResponse = z.infer<typeof PlaceOrderResponse>;
