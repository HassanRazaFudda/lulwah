import { z } from 'zod';

/**
 * Enum reference — plan.md §32 Appendix A, transcribed value-for-value.
 * This is the single source of truth for every controlled vocabulary in
 * the system: the API validates with these, the storefront and admin
 * infer their TS types from them. A status can never be added on the
 * backend and forgotten in the admin dropdown — the compiler stops it
 * (plan.md §6.1).
 *
 * No TS `enum` keyword anywhere (plan.md §27.1) — `z.enum` plus the
 * inferred union type instead.
 */

export const StitchingType = z.enum(['unstitched', 'semi_stitched', 'pret', 'custom_stitchable']);
export type StitchingType = z.infer<typeof StitchingType>;

/** Not a `z.enum` — the plan defines this as the literal union `1 | 2 | 3`. */
export const PieceCount = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type PieceCount = z.infer<typeof PieceCount>;

export const Fabric = z.enum([
  'lawn',
  'cambric',
  'cotton',
  'cotton_net',
  'khaddar',
  'linen',
  'karandi',
  'chiffon',
  'organza',
  'silk',
  'raw_silk',
  'jacquard',
  'velvet',
  'viscose',
  'net',
  'masuri',
  'grip',
  'tissue',
  'banarsi',
  'jamawar',
  'crinkle_chiffon',
  'slub',
]);
export type Fabric = z.infer<typeof Fabric>;

export const Work = z.enum([
  'digital_print',
  'screen_print',
  'block_print',
  'machine_embroidery',
  'hand_embroidery',
  'zari',
  'resham',
  'tilla',
  'mukaish',
  'gota',
  'sequins',
  'dabka',
  'naqshi',
  'applique',
  'mirror_work',
  'plain',
]);
export type Work = z.infer<typeof Work>;

export const Occasion = z.enum([
  'everyday',
  'casual',
  'workwear',
  'eid',
  'festive',
  'mehndi',
  'mayoun',
  'barat',
  'walima',
  'nikkah',
  'party',
  'bridal',
]);
export type Occasion = z.infer<typeof Occasion>;

export const Season = z.enum(['summer', 'winter', 'all_season', 'festive']);
export type Season = z.infer<typeof Season>;

export const DupattaType = z.enum(['printed', 'embroidered', 'chiffon', 'organza', 'net', 'silk', 'none']);
export type DupattaType = z.infer<typeof DupattaType>;

export const ColorFamily = z.enum([
  'white_offwhite',
  'black',
  'red_maroon',
  'pink',
  'blue_ferozi',
  'green',
  'yellow_mustard',
  'purple',
  'brown_beige',
  'grey_silver',
  'gold',
  'multi',
]);
export type ColorFamily = z.infer<typeof ColorFamily>;

export const Size = z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'free']);
export type Size = z.infer<typeof Size>;

export const Emirate = z.enum([
  'dubai',
  'abu_dhabi',
  'sharjah',
  'ajman',
  'ras_al_khaimah',
  'fujairah',
  'umm_al_quwain',
]);
export type Emirate = z.infer<typeof Emirate>;

/** The delivery-tracking state machine — plan.md §8.7. See `order.ts` for
 *  the allowed-transition map and `UpdateOrderStatusInput`. */
export const OrderStatus = z.enum([
  'pending_payment',
  'confirmed',
  'processing',
  'stitching',
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
  'failed',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentStatus = z.enum(['unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentMethod = z.enum(['card', 'apple_pay', 'google_pay', 'cod', 'tabby', 'tamara', 'bank_transfer']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const ReturnStatus = z.enum([
  'requested',
  'approved',
  'picked_up',
  'received',
  'inspected',
  'refunded',
  'rejected',
]);
export type ReturnStatus = z.infer<typeof ReturnStatus>;

export const DiscountType = z.enum(['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y', 'tiered', 'bundle']);
export type DiscountType = z.infer<typeof DiscountType>;

export const UserRole = z.enum([
  'customer',
  'support',
  'catalog',
  'order_ops',
  'warehouse',
  'content',
  'finance',
  'manager',
  'super_admin',
]);
export type UserRole = z.infer<typeof UserRole>;
