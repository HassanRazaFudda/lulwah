import { z } from 'zod';

/**
 * The closed error-code enum — plan.md §33 Appendix B, transcribed
 * verbatim. The UI maps `code` to a localized message; it never displays
 * a raw backend string.
 */
export const ErrorCode = z.enum([
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_ACCOUNT_LOCKED',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_REUSED',
  'AUTH_EMAIL_EXISTS',
  'AUTH_OTP_INVALID',
  'AUTH_OTP_EXPIRED',
  'AUTH_2FA_REQUIRED',
  'AUTH_FORBIDDEN',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'CART_NOT_FOUND',
  'CART_ITEM_LIMIT',
  'CART_QTY_LIMIT',
  'OUT_OF_STOCK',
  'INSUFFICIENT_STOCK',
  'VARIANT_INACTIVE',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'COUPON_USAGE_LIMIT',
  'COUPON_NOT_ELIGIBLE',
  'COUPON_MIN_SUBTOTAL',
  'COUPON_ALREADY_APPLIED',
  'CHECKOUT_SESSION_EXPIRED',
  'CHECKOUT_PRICE_CHANGED',
  'CHECKOUT_ADDRESS_INVALID',
  'PAYMENT_FAILED',
  'PAYMENT_DECLINED',
  'PAYMENT_3DS_FAILED',
  'COD_NOT_ALLOWED',
  'COD_LIMIT_EXCEEDED',
  'COD_OTP_REQUIRED',
  'ORDER_NOT_FOUND',
  'INVALID_STATUS_TRANSITION',
  'ORDER_NOT_CANCELLABLE',
  'RETURN_WINDOW_CLOSED',
  'ITEM_NOT_RETURNABLE',
  'SHIPPING_UNAVAILABLE',
  'RATE_LIMITED',
  'IDEMPOTENCY_CONFLICT',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ResponseMeta = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  total: z.number().int().nonnegative().optional(),
  hasMore: z.boolean().optional(),
});
export type ResponseMeta = z.infer<typeof ResponseMeta>;

export const ApiErrorShape = z.object({
  code: ErrorCode,
  message: z.string(),
  messageAr: z.string().optional(),
  field: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiErrorShape = z.infer<typeof ApiErrorShape>;

/** The error half of the envelope — plan.md §9.1. */
export const ErrorEnvelope = z.object({
  success: z.literal(false),
  error: ApiErrorShape,
  requestId: z.string(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

/**
 * The success half of the envelope — plan.md §9.1. `data` is generic per
 * endpoint, so this is a factory rather than a fixed schema: each route's
 * DTO calls `successEnvelope(ProductListItem)` etc.
 */
export function successEnvelope<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: ResponseMeta.optional(),
  });
}

/** The full response envelope for an endpoint — success or error, discriminated on `success`. */
export function apiEnvelope<T extends z.ZodType>(dataSchema: T) {
  return z.discriminatedUnion('success', [successEnvelope(dataSchema), ErrorEnvelope]);
}
