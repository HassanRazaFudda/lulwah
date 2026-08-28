import type { Emirate } from '@lulwah/contracts';

/**
 * Display labels for `@lulwah/contracts`' `Emirate` enum (plan.md §21: "R1:
 * seven emirates, single zone"). No such label map existed anywhere in
 * `apps/admin`/`apps/web` before this — the Settings screen's shipping-rate
 * table and store-address emirate select are the first UI in this app to
 * need one. Mirrors `lib/queries/orders.ts#CARRIER_LABELS`'s "closed enum →
 * a plain `Record`" precedent.
 */
export const EMIRATES: readonly Emirate[] = [
  'dubai',
  'abu_dhabi',
  'sharjah',
  'ajman',
  'ras_al_khaimah',
  'fujairah',
  'umm_al_quwain',
] as const;

export const EMIRATE_LABELS: Record<Emirate, string> = {
  dubai: 'Dubai',
  abu_dhabi: 'Abu Dhabi',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  ras_al_khaimah: 'Ras Al Khaimah',
  fujairah: 'Fujairah',
  umm_al_quwain: 'Umm Al Quwain',
};
