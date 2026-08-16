/**
 * Commerce constants — plan.md §1.4 "Commercial parameters (locked
 * defaults)". The plan itself notes these are "configurable in Admin →
 * Settings, not hardcoded" in the real system; here, with no admin/API
 * wired up, they're the one hardcoded source of truth the cart/checkout
 * skeleton computes against.
 */
export const FREE_SHIPPING_THRESHOLD_FILS = 30_000; // AED 300
export const STANDARD_SHIPPING_FILS = 2_000; // AED 20 flat, UAE-wide
export const COD_FEE_FILS = 1_000; // AED 10
export const COD_MAX_ORDER_FILS = 200_000; // AED 2,000 cap
export const VAT_RATE = 0.05; // 5% UAE VAT, prices displayed VAT-inclusive
export const RETURNS_WINDOW_DAYS = 14;
