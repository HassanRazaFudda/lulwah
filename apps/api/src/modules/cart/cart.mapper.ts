import type { Cart, CartItem } from '@lulwah/contracts';
import type { CartDoc, CartHydratedDoc, CartItemDoc } from './cart.model.js';
import type { CartItemView, CartResponse } from './cart.dto.js';

function toCartItemDto(item: CartItemDoc): CartItem {
  return {
    id: item._id.toString(),
    productId: item.productId.toString(),
    variantId: item.variantId.toString(),
    quantity: item.quantity,
    unitPriceFils: item.unitPriceFils,
    compareAtPriceFils: item.compareAtPriceFils,
    stitching: item.stitching
      ? { enabled: item.stitching.enabled, measurementProfileId: item.stitching.measurementProfileId ? item.stitching.measurementProfileId.toString() : null, priceFils: item.stitching.priceFils, leadDays: item.stitching.leadDays }
      : null,
    giftWrap: item.giftWrap,
    addedAt: item.addedAt,
    priceLockedUntil: item.priceLockedUntil,
  };
}

export function toCartDto(doc: CartDoc | CartHydratedDoc): Cart {
  return {
    cartId: doc.cartId,
    userId: doc.userId ? doc.userId.toString() : null,
    sessionId: doc.sessionId,
    items: doc.items.map(toCartItemDto),
    appliedCoupons: doc.appliedCoupons.map((c) => ({ code: c.code, discountId: c.discountId.toString(), amountFils: c.amountFils })),
    automaticDiscounts: doc.automaticDiscounts.map((d) => ({ discountId: d.discountId.toString(), name: d.name, amountFils: d.amountFils })),
    totals: {
      subtotalFils: doc.totals.subtotalFils,
      discountFils: doc.totals.discountFils,
      shippingFils: doc.totals.shippingFils,
      codFeeFils: doc.totals.codFeeFils,
      taxFils: doc.totals.taxFils,
      grandTotalFils: doc.totals.grandTotalFils,
    },
    shippingAddressId: doc.shippingAddressId ? doc.shippingAddressId.toString() : null,
    shippingMethodId: doc.shippingMethodId ? doc.shippingMethodId.toString() : null,
    currency: doc.currency,
    locale: doc.locale,
    status: doc.status,
    abandonedEmailsSent: doc.abandonedEmailsSent,
    lastActivityAt: doc.lastActivityAt,
    expiresAt: doc.expiresAt,
  };
}

/** `Cart` plus the per-item read-time flags `cart.service.ts`'s
 *  recalculation computes (plan.md §8.5) — see `cart.dto.ts`'s doc comment
 *  on why those live in the response DTO, not the stored/shared `Cart`
 *  schema. */
export function toCartResponse(doc: CartDoc | CartHydratedDoc, itemFlags: ReadonlyMap<string, { priceChanged: boolean; availableStock: number }>): CartResponse {
  const base = toCartDto(doc);
  const items: CartItemView[] = base.items.map((item) => {
    const flags = itemFlags.get(item.id);
    return { ...item, priceChanged: flags?.priceChanged ?? false, availableStock: flags?.availableStock ?? 0 };
  });
  return { ...base, items };
}
