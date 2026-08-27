import { z } from 'zod';
import { objectId } from './common.js';
import { Emirate } from './enums.js';
import { Fils } from './money.js';

/**
 * Settings — plan.md §11.1's admin Settings screen. A genuine singleton
 * (one row, no list/detail routes, no `id` a client would ever look up
 * by — see `apps/api`'s `settings` module report for the storage
 * mechanics). This is the DB-backed home for values that used to be
 * hardcoded constants read straight out of `env.ts`/`config/constants.ts`
 * (plan.md §31 Q5: shipping rates and the free-shipping threshold are
 * "editable in Admin → Settings") — `checkout`/`cart`/`order` now read
 * shipping/COD/tax through this module's exported service function
 * instead, seeded once from those same constants so behavior is
 * unchanged until an admin actually edits a value.
 *
 * Three things the plan.md §11.1 row also lists are deliberately NOT
 * here — see `apps/api`'s settings module report for the full reasoning:
 * - **Payment gateway keys** never leave `.env` (plan.md §19). `paymentGateway`
 *   below is a computed, masked, read-only presence check only — it is never
 *   accepted on `PATCH`, and no field anywhere on this contract can carry a
 *   raw key.
 * - **Email/SMS templates** — `shared/notify.ts` is a documented stub with
 *   no real provider configured; there is nothing to template yet.
 * - **Legal pages** — owned by the parallel `content` module's `Page` type,
 *   not duplicated here.
 */

export const ShippingRate = z.object({
  emirate: Emirate,
  feeFils: Fils,
  etaMinDays: z.number().int().positive(),
  etaMaxDays: z.number().int().positive(),
});
export type ShippingRate = z.infer<typeof ShippingRate>;

export const StoreAddress = z.object({
  line1: z.string(),
  line2: z.string(),
  city: z.string(),
  emirate: Emirate,
  country: z.literal('AE'),
});
export type StoreAddress = z.infer<typeof StoreAddress>;

/** `trn` — UAE Tax Registration Number, plan.md §11.1's "Store details + TRN". */
export const StoreDetails = z.object({
  name: z.string().min(1),
  trn: z.string(),
  email: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  address: StoreAddress,
});
export type StoreDetails = z.infer<typeof StoreDetails>;

export const ShippingSettings = z.object({
  rates: z.array(ShippingRate),
  freeShippingThresholdFils: Fils,
});
export type ShippingSettings = z.infer<typeof ShippingSettings>;

export const CodSettings = z.object({
  feeFils: Fils,
  maxOrderFils: Fils,
});
export type CodSettings = z.infer<typeof CodSettings>;

/**
 * Never a raw key (plan.md §19) — computed from `env.ts` at read time,
 * never persisted alongside the rest of `Settings`, never accepted as
 * `PATCH` input. `provider` is a literal (not an enum) because there is
 * exactly one gateway integration in this codebase today; widen it if a
 * second one is ever added.
 */
export const PaymentGatewayStatus = z.object({
  provider: z.literal('ziina'),
  apiKeyConfigured: z.boolean(),
  webhookSecretConfigured: z.boolean(),
});
export type PaymentGatewayStatus = z.infer<typeof PaymentGatewayStatus>;

export const Settings = z.object({
  storeDetails: StoreDetails,
  shipping: ShippingSettings,
  cod: CodSettings,
  /** VAT — a fraction in `[0, 1]`, e.g. `0.05` for UAE's standard 5% rate. */
  taxRate: z.number().min(0).max(1),
  featureFlags: z.record(z.string(), z.boolean()),
  maintenanceMode: z.boolean(),
  paymentGateway: PaymentGatewayStatus,
  updatedAt: z.coerce.date(),
  updatedByUserId: objectId.nullable(),
});
export type Settings = z.infer<typeof Settings>;
