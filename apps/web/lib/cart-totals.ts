import type { CartLineItem } from '@/stores/cart-store';
import { FREE_SHIPPING_THRESHOLD_FILS, STANDARD_SHIPPING_FILS, VAT_RATE } from './commerce-constants';

/**
 * Cart total maths — plan.md §8.1/§1.4. Prices are stored and displayed
 * **VAT-inclusive** (UAE consumer law, §1.4), so `taxFils` here is
 * extracted *from* the inclusive subtotal for the invoice breakdown line,
 * never added on top: `tax = subtotal - subtotal / (1 + rate)`.
 */
export interface CartTotals {
  subtotalFils: number;
  shippingFils: number;
  /** 0 once the order already qualifies for free shipping. */
  freeShippingRemainderFils: number;
  taxFils: number;
  grandTotalFils: number;
}

export function computeCartTotals(items: CartLineItem[]): CartTotals {
  const subtotalFils = items.reduce((sum, item) => sum + item.unitPriceFils * item.quantity, 0);
  const qualifiesForFreeShipping = items.length > 0 && subtotalFils >= FREE_SHIPPING_THRESHOLD_FILS;
  const shippingFils = items.length === 0 || qualifiesForFreeShipping ? 0 : STANDARD_SHIPPING_FILS;
  const freeShippingRemainderFils = qualifiesForFreeShipping ? 0 : Math.max(FREE_SHIPPING_THRESHOLD_FILS - subtotalFils, 0);
  const taxFils = Math.round(subtotalFils - subtotalFils / (1 + VAT_RATE));
  const grandTotalFils = subtotalFils + shippingFils;

  return { subtotalFils, shippingFils, freeShippingRemainderFils, taxFils, grandTotalFils };
}
