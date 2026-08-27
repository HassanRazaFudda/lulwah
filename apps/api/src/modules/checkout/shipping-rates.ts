import type { Emirate } from '@lulwah/contracts';
import * as settingsService from '../settings/settings.service.js';

/**
 * plan.md §21: "R1 shipping is simple, not carrier-integrated — a flat
 * rate per emirate... no real Aramex API." Not a `shipping_zones` admin
 * CRUD collection of its own — the rate table and free-shipping
 * threshold are DB-backed via the `settings` module instead (plan.md §31
 * Q5: "editable in Admin → Settings"), seeded to the exact values this
 * file used to hardcode so behavior is unchanged until an admin edits
 * them (see `settings.service.ts#buildDefaultSettings`'s doc comment).
 */

export interface ShippingQuote {
  id: string;
  name: string;
  carrier: string;
  etaMinDays: number;
  etaMaxDays: number;
  priceFils: number;
}

/** Standard delivery, waived above the configured free-shipping
 *  threshold — both now read from `settings.service.ts#getSettingsSnapshot`
 *  instead of hardcoded constants. Falls back to a same-day-ish 1–3 day
 *  ETA at zero fee for an emirate somehow missing from the configured
 *  rate table (should not happen — every emirate is seeded — but a
 *  quote must never throw over a data gap). */
export async function quoteShipping(emirate: Emirate, subtotalFils: number): Promise<ShippingQuote> {
  const settings = await settingsService.getSettingsSnapshot();
  const rate = settings.shippingRates.find((r) => r.emirate === emirate);
  const isFree = subtotalFils >= settings.freeShippingThresholdFils;
  return {
    id: 'standard',
    name: 'Standard delivery',
    carrier: 'own_fleet',
    etaMinDays: rate?.etaMinDays ?? 1,
    etaMaxDays: rate?.etaMaxDays ?? 3,
    priceFils: isFree ? 0 : (rate?.feeFils ?? 0),
  };
}
