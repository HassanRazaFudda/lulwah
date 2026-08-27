import type { Emirate, Settings, ShippingRate } from '@lulwah/contracts';
import { env } from '../../shared/env.js';
import { STANDARD_SHIPPING_FEE_FILS } from '../../config/constants.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './settings.repository.js';
import type { SettingsDefaults } from './settings.repository.js';
import { toSettingsDto } from './settings.mapper.js';
import type { AdminUpdateSettingsInput } from './settings.dto.js';

/**
 * ALL settings business rules live here, framework-free (no `express`).
 * `settings.controller.ts` only parses/shapes; `settings.repository.ts`
 * only persists.
 */

/** Per-emirate ETA table — the exact values `checkout/shipping-rates.ts`
 *  hardcoded before this module existed (plan.md §21: "flat rate per
 *  emirate", every emirate happens to share one fee/lead-time band today,
 *  kept as a real per-emirate row rather than one bare constant so a
 *  future emirate-specific change is a data edit, not a new code path —
 *  the same reasoning that file's own doc comment already gave). */
const DEFAULT_ETA_BY_EMIRATE: Record<Emirate, { etaMinDays: number; etaMaxDays: number }> = {
  dubai: { etaMinDays: 1, etaMaxDays: 3 },
  abu_dhabi: { etaMinDays: 1, etaMaxDays: 3 },
  sharjah: { etaMinDays: 1, etaMaxDays: 3 },
  ajman: { etaMinDays: 2, etaMaxDays: 4 },
  ras_al_khaimah: { etaMinDays: 2, etaMaxDays: 4 },
  fujairah: { etaMinDays: 2, etaMaxDays: 4 },
  umm_al_quwain: { etaMinDays: 2, etaMaxDays: 4 },
};

/**
 * The seed used the very first time anyone reads Settings
 * (`getOrCreateSettings`'s `$setOnInsert`) — deliberately built from the
 * exact env vars/constants that used to be the hardcoded source of truth
 * for shipping/COD/tax (plan.md §31 Q5: shipping rates and the
 * free-shipping threshold are "editable in Admin → Settings"), so this
 * migration is invisible until an admin actually edits a value: every
 * already-passing P2 checkout/COD/tax test keeps asserting against the
 * same numbers, now read from Mongo instead of `process.env` at request
 * time. `env.STORE_*` (already declared in `env.ts` for exactly this,
 * unused until now) seed `storeDetails`; there was no pre-existing
 * hardcoded store address, so that starts blank.
 */
export function buildDefaultSettings(): SettingsDefaults {
  const rates: ShippingRate[] = (Object.keys(DEFAULT_ETA_BY_EMIRATE) as Emirate[]).map((emirate) => ({
    emirate,
    feeFils: STANDARD_SHIPPING_FEE_FILS,
    etaMinDays: DEFAULT_ETA_BY_EMIRATE[emirate].etaMinDays,
    etaMaxDays: DEFAULT_ETA_BY_EMIRATE[emirate].etaMaxDays,
  }));

  return {
    storeDetails: {
      name: env.STORE_NAME ?? 'Lulwah Fashion',
      trn: env.STORE_TRN ?? '',
      email: env.STORE_EMAIL ?? '',
      phone: env.STORE_PHONE ?? '',
      whatsapp: env.STORE_WHATSAPP ?? '',
      address: { line1: '', line2: '', city: '', emirate: 'dubai', country: 'AE' },
    },
    shipping: { rates, freeShippingThresholdFils: env.FREE_SHIPPING_THRESHOLD_FILS },
    cod: { feeFils: env.COD_FEE_FILS, maxOrderFils: env.COD_MAX_ORDER_FILS },
    taxRate: env.VAT_RATE,
    featureFlags: {},
    maintenanceMode: false,
  };
}

export async function adminGetSettings(actor: AuthenticatedUser): Promise<Settings> {
  assertPermission(actor, 'settings.read');
  const doc = await repo.getOrCreateSettings(buildDefaultSettings());
  return toSettingsDto(doc);
}

export async function adminUpdateSettings(actor: AuthenticatedUser, input: AdminUpdateSettingsInput): Promise<Settings> {
  assertPermission(actor, 'settings.write');
  // Ensure the singleton exists first — a PATCH can legitimately be the
  // very first request this module ever sees (no admin necessarily
  // called GET first), and `updateSettings`'s plain `findOneAndUpdate`
  // (no upsert) would otherwise silently no-op against a document that
  // was never created.
  await repo.getOrCreateSettings(buildDefaultSettings());
  const updated = await repo.updateSettings({ ...input, updatedByUserId: actor.id });
  // Unreachable in practice (the line above guarantees the document
  // exists), kept only so this function's return type is never `null`.
  if (!updated) throw new Error('Settings document unexpectedly missing after getOrCreateSettings.');
  return toSettingsDto(updated);
}

// ---------------------------------------------------------------------------
// Cross-module entry point — `cart`/`checkout`/`order`'s exclusive way
// into this module's DB-backed config (plan.md §5.3): never `SettingsModel`
// directly, only this function. Read-only, no RBAC — same pattern as
// `catalog`'s `getBrandsByIds`/`brand.service.ts`, an internal system read
// no permission check gates.
// ---------------------------------------------------------------------------

export interface SettingsSnapshot {
  shippingRates: ShippingRate[];
  freeShippingThresholdFils: number;
  codFeeFils: number;
  codMaxOrderFils: number;
  taxRate: number;
  maintenanceMode: boolean;
  featureFlags: Record<string, boolean>;
}

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const doc = await repo.getOrCreateSettings(buildDefaultSettings());
  return {
    shippingRates: doc.shipping.rates,
    freeShippingThresholdFils: doc.shipping.freeShippingThresholdFils,
    codFeeFils: doc.cod.feeFils,
    codMaxOrderFils: doc.cod.maxOrderFils,
    taxRate: doc.taxRate,
    maintenanceMode: doc.maintenanceMode,
    featureFlags: doc.featureFlags,
  };
}
