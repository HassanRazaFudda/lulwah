import type { Emirate } from '@lulwah/contracts';
import { STANDARD_SHIPPING_FEE_FILS } from '../../config/constants.js';
import { env } from '../../shared/env.js';

/**
 * plan.md §21: "R1 shipping is simple, not carrier-integrated — a flat
 * rate per emirate... no real Aramex API." A small hardcoded table, not a
 * `shipping_zones` admin CRUD — correct scope for this phase per the
 * brief. Kept as a per-emirate table (rather than one bare constant) so a
 * future emirate-specific rate or lead time is a data edit here, not a new
 * code path; every emirate happens to get the same rate/ETA today.
 */

export interface ShippingQuote {
  id: string;
  name: string;
  carrier: string;
  etaMinDays: number;
  etaMaxDays: number;
  priceFils: number;
}

const RATE_TABLE: Record<Emirate, { etaMinDays: number; etaMaxDays: number }> = {
  dubai: { etaMinDays: 1, etaMaxDays: 3 },
  abu_dhabi: { etaMinDays: 1, etaMaxDays: 3 },
  sharjah: { etaMinDays: 1, etaMaxDays: 3 },
  ajman: { etaMinDays: 2, etaMaxDays: 4 },
  ras_al_khaimah: { etaMinDays: 2, etaMaxDays: 4 },
  fujairah: { etaMinDays: 2, etaMaxDays: 4 },
  umm_al_quwain: { etaMinDays: 2, etaMaxDays: 4 },
};

/** Standard AED 20, waived above `env.FREE_SHIPPING_THRESHOLD_FILS` — both
 *  already-existing `env` values, declared for exactly this by a phase
 *  that had no `checkout` module yet to consume them. */
export function quoteShipping(emirate: Emirate, subtotalFils: number): ShippingQuote {
  const eta = RATE_TABLE[emirate];
  const isFree = subtotalFils >= env.FREE_SHIPPING_THRESHOLD_FILS;
  return {
    id: 'standard',
    name: 'Standard delivery',
    carrier: 'own_fleet',
    etaMinDays: eta.etaMinDays,
    etaMaxDays: eta.etaMaxDays,
    priceFils: isFree ? 0 : STANDARD_SHIPPING_FEE_FILS,
  };
}
