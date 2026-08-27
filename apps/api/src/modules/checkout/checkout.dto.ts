import { z } from 'zod';
import { AddressLabel, Emirate, PaymentMethod, UserPhone, objectId } from '@lulwah/contracts';

/**
 * Request/response DTOs for `checkout` — plan.md §9.5. No `CheckoutSession`
 * wire contract exists in `@lulwah/contracts` (see `checkout.model.ts`'s
 * doc comment on why) — the response shape below is this module's own,
 * same "module-local DTO" precedent `cart.dto.ts#CartResponse` sets.
 */

export const CreateCheckoutSessionInput = z.object({
  cartId: z.string().min(1),
  /** Guest-checkout contact email — logged-in customers get theirs from
   *  their account (plan.md §15.6: "no forced account creation" for
   *  everyone else). Optional here; enforced as required-if-guest at
   *  `place` (see `checkout.service.ts`). */
  guestEmail: z.string().email().optional(),
});
export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionInput>;

/** An address supplied inline (guest checkout, or a logged-in customer
 *  entering a new address without saving it to their book first) — the
 *  same field set as `identity`'s `Address` minus `id`/`userId`/default
 *  flags, defined fresh here rather than importing `identity`'s own DTO
 *  file (plan.md §5.3: cross-module calls go through a service function,
 *  not another module's request-validation internals). */
export const InlineAddressInput = z.object({
  label: AddressLabel.default('home'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: UserPhone,
  emirate: Emirate,
  city: z.string().min(1),
  area: z.string().min(1),
  buildingName: z.string().min(1),
  apartment: z.string().optional(),
  street: z.string().optional(),
  landmark: z.string().min(1),
  makani: z.string().nullable().default(null),
  poBox: z.string().nullable().default(null),
  geo: z.object({ lat: z.number(), lng: z.number() }).nullable().default(null),
});
export type InlineAddressInput = z.infer<typeof InlineAddressInput>;

/** Exactly one of `addressId` (an existing saved address, logged-in
 *  customers only) or `inline` (guest checkout, or a fresh address) must
 *  be given — enforced in `checkout.service.ts`, not here (a cross-field
 *  refinement reads awkwardly split from the "which one" business rule it
 *  actually encodes). */
export const SetCheckoutAddressInput = z.object({
  shipping: z.object({ addressId: objectId.optional(), inline: InlineAddressInput.optional() }),
  billingSameAsShipping: z.boolean().default(true),
  billing: z.object({ addressId: objectId.optional(), inline: InlineAddressInput.optional() }).optional(),
});
export type SetCheckoutAddressInput = z.infer<typeof SetCheckoutAddressInput>;

/** plan.md §21: one flat-rate method for R1 — this endpoint confirms it
 *  rather than choosing among several (no carrier-integrated rate
 *  shopping exists to choose *from*). Accepts an empty body. */
export const SetCheckoutShippingInput = z.object({}).strict();
export type SetCheckoutShippingInput = z.infer<typeof SetCheckoutShippingInput>;

export const CreatePaymentIntentInput = z.object({ method: PaymentMethod });
export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentInput>;

export const VerifyCodOtpInput = z.object({ sessionId: z.string().min(1), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') });
export type VerifyCodOtpInput = z.infer<typeof VerifyCodOtpInput>;

export const PlaceOrderInput = z.object({ customerNote: z.string().max(1000).optional() });
export type PlaceOrderInput = z.infer<typeof PlaceOrderInput>;

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

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
  shippingMethod: z.object({ id: z.string(), name: z.string(), carrier: z.string(), etaMinDays: z.number(), etaMaxDays: z.number(), priceFils: z.number() }).nullable(),
  paymentMethod: PaymentMethod.nullable(),
  status: z.enum(['open', 'completed', 'expired']),
  expiresAt: z.coerce.date(),
});
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponse>;

/** `redirectUrl` — renamed from `clientSecret` (plan.md §20's Ziina swap):
 *  Ziina is a hosted-redirect gateway with no client-side confirmation
 *  step, so there is no secret for a client to hold. `null` for `cod`
 *  (its "confirmation" is the OTP flow, `otpRequired`); a real URL for
 *  `card`, which the client should send the browser to. See
 *  `payment-gateway.ts#CreateIntentResult`'s doc comment for the full
 *  rationale — this DTO just mirrors that rename one level up, since
 *  `checkout`'s response shape isn't in `@lulwah/contracts` (no wire
 *  contract exists for `CheckoutSession`/this response yet — see
 *  `checkout.model.ts`'s doc comment), so the rename touched no shared
 *  package and nothing outside this module + `apps/web` (out of scope for
 *  this change; a later stage builds the storefront redirect UI against
 *  this new shape). */
export const PaymentIntentResponse = z.object({
  method: PaymentMethod,
  redirectUrl: z.string().nullable(),
  otpRequired: z.boolean(),
});
export type PaymentIntentResponse = z.infer<typeof PaymentIntentResponse>;
