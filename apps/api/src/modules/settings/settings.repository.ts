import type { PartialWithUndefined } from '../../shared/types.js';
import { SettingsModel, SETTINGS_SINGLETON_ID } from './settings.model.js';
import type { SettingsDoc, SettingsHydratedDoc } from './settings.model.js';

/**
 * The ONLY file allowed to touch `SettingsModel` (plan.md §5.4). No
 * business rules — just reads/writes.
 */

export type SettingsDefaults = Pick<SettingsDoc, 'storeDetails' | 'shipping' | 'cod' | 'taxRate' | 'featureFlags' | 'maintenanceMode'>;

/** Same "no deep-partial merge" convention `pricing`'s `conditions`/`usage`
 *  and `catalog`'s nested subdocs already use: a nested object field
 *  (`storeDetails`, `shipping`, `cod`) is replaced whole when provided,
 *  never merged key-by-key. `updatedByUserId` is typed as a plain string
 *  here (not `Types.ObjectId`) so `settings.service.ts` never needs to
 *  import `mongoose` itself — Mongoose casts a valid hex string to an
 *  `ObjectId` automatically at the schema boundary, same as every other
 *  repository's `*Input` type that takes an id as a string. */
export type UpdateSettingsInput = PartialWithUndefined<Pick<SettingsDoc, 'storeDetails' | 'shipping' | 'cod' | 'taxRate' | 'featureFlags' | 'maintenanceMode'>> & {
  updatedByUserId?: string | null | undefined;
};

/**
 * Atomic "get it, seeding it with today's defaults if this is the very
 * first read anyone has ever done" — a single `findOneAndUpdate` with
 * `upsert: true` against the fixed singleton `_id`, not a separate
 * find-then-create (which would race under concurrent first requests).
 * `$setOnInsert` means an existing document's real values are never
 * clobbered back to the defaults on a later call.
 */
export async function getOrCreateSettings(defaults: SettingsDefaults): Promise<SettingsHydratedDoc> {
  const doc = await SettingsModel.findOneAndUpdate({ _id: SETTINGS_SINGLETON_ID }, { $setOnInsert: defaults }, { upsert: true, returnDocument: 'after' }).exec();
  // findOneAndUpdate with upsert:true + returnDocument:'after' always
  // returns a document — the null case in Mongoose's own types is for the
  // (impossible here) upsert:false miss.
  return doc as SettingsHydratedDoc;
}

export async function updateSettings(patch: UpdateSettingsInput): Promise<SettingsHydratedDoc | null> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }
  return SettingsModel.findOneAndUpdate({ _id: SETTINGS_SINGLETON_ID }, { $set: set }, { returnDocument: 'after' }).exec();
}
